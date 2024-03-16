import axios from "axios";
import dotenv from "dotenv";
import db from "../../models/db";
import ITSPostParserError from "../../libs/errors/ITSPostParserError";
import NotExistingReferencedSolutionError from "../../libs/errors/NotExistingReferencedSolutionError";
import NotExistingTestCaseError from "../../libs/errors/NotExistingTestCaseError";
import ITSPostFeedbackError from "../../libs/errors/ITSPostFeedbackError";
import { ErrorFeedback } from "../../models/its/error-feedback";
import CodeFunctionNameError from "../../libs/errors/CodeFunctionNameError";

dotenv.config();

const api = axios.create({
  baseURL: process.env.ITS_API_URL,
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "Grading Service",
    "Accept-Encoding": "gzip",
  },
});

api.interceptors.request.use((config) => {
  // log the request body
  console.log("Request body: ", config.data);

  return config;
});

const generateParserString = async (language: string, source_code: string) => {
  try {
    const response = await api.post("/cs3213/parser", {
      language: language,
      source_code: source_code,
    });

    const parser = response.data;

    const parserString = JSON.stringify(parser);

    return parserString;
  } catch (error) {
    if (error === typeof axios.AxiosError) {
      throw new ITSPostParserError();
    }

    throw error;
  }
};

const generateErrorFeedback = async (
  language: string,
  studentCode: string,
  questionId: string,
  studentId: number
) => {
  // obtain referenced solution parser
  const referencedSolution = await db.referenceSolution.findFirst({
    where: {
      questionId: questionId,
      language: language === "py" ? "python" : language,
    },
  });

  if (!referencedSolution) {
    throw new NotExistingReferencedSolutionError();
  }

  let referencedSolutionParserString = referencedSolution.codeParser as string;

  if (!referencedSolution.codeParser) {
    referencedSolutionParserString = (await generateParserString(
      language,
      referencedSolution.code
    )) as string;

    // write back to database
    await db.referenceSolution.update({
      where: {
        id: referencedSolution.id,
      },
      data: {
        codeParser: referencedSolutionParserString,
      },
    });
  }

  // obtain the target function name
  const targetFunction = Object.keys(
    JSON.parse(referencedSolutionParserString).fncs
  )[0];

  // obtain student solution parser
  const studentSolutionParserString = await generateParserString(
    language,
    studentCode
  );

  // check if the student solution has the target function
  if (!JSON.parse(studentSolutionParserString).fncs[targetFunction]) {
    throw new CodeFunctionNameError();
  }

  // get a test case
  const testCase = await db.testCase.findFirst({
    where: {
      questionId: questionId,
    },
  });

  if (!testCase) {
    throw new NotExistingTestCaseError();
  }

  // args
  const args = "[" + testCase.input + "]";

  // call ITS API to generate error feedback
  try {
    const response = await api.post("/cs3213/feedback_error", {
      language: language,
      reference_solution: referencedSolutionParserString,
      student_solution: studentSolutionParserString,
      inputs: "[]",
      function: targetFunction,
      args: args,
    });

    const feedbacks = response.data as ErrorFeedback[];

    // write to Submission table
    await saveSubmissionWithFeedbacks(
      questionId,
      studentId,
      language,
      studentCode,
      studentSolutionParserString,
      feedbacks
    );

    return feedbacks;
  } catch (error) {
    if (error instanceof axios.AxiosError) {
      console.log(error.response?.data);
      throw new ITSPostFeedbackError();
    }

    throw error;
  }
};

export const ITSApi = {
  generateParserString,
  generateErrorFeedback,
};

/**
 * Hepler function to save feedbacks to database
 */
async function saveSubmissionWithFeedbacks(
  questionId: string,
  studentId: number,
  language: string,
  studentCode: string,
  studentSolutionParserString: string,
  feedbacks: ErrorFeedback[]
) {
  // if the submission already exists, delete it
  const existingSubmission = await db.submission.findFirst({
    where: {
      questionId: questionId,
      studentId: studentId,
    },
  });

  if (existingSubmission) {
    await db.submission.delete({
      where: {
        id: existingSubmission.id,
      },
    });
  }

  const submission = await db.submission.create({
    data: {
      questionId: questionId,
      studentId: studentId,
      language: language === "py" ? "python" : language,
      code: studentCode,
      codeParser: studentSolutionParserString,
    },
  });

  // write to Feedback table
  await db.feedback.createMany({
    data: feedbacks.map((feedback) => {
      return {
        submissionId: submission.id,
        line: feedback.lineNumber,
        hints: feedback.hintStrings,
      };
    }),
  });
}
