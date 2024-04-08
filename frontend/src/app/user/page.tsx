"use client";
import userService from "@/helpers/user-service/api-wrapper";
import ProfileEditor from "../../components/forms/ProfileEditor";
import AccountEditor from "../../components/forms/AccountEditor";
import { useEffect, useState } from "react";
import LogoLoading from "@/components/common/LogoLoading";
import { useUserContext } from "@/contexts/user-context";
import { useRouter } from "next/navigation";
import { toast } from 'react-toastify';

export default function Page() {
  const [userInfo, setUserInfo] = useState<UserInfo>({} as UserInfo);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { user } = useUserContext();
  const router = useRouter();

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        if (user === null) {
          toast.error("You must login to view user page");
          router.push("/");
        } else {
          const retrievedUserInfo = await userService.getUserInfo(user.uid);
          if (retrievedUserInfo === null) {
            toast.error("Unable to get user data");
            router.push("/");
          } else {
            setUserInfo(retrievedUserInfo);
          }
        }
        setIsLoading(false);
      } catch (error) { 
        console.error("Error fetching user info:", error);
        toast.error("An unexpected error occurred");
        // Handle the error based on its type
        setIsLoading(false);
      }
    };

    if (user) {
      fetchUserInfo().catch((err) => console.log(err));
    } else {
      setIsLoading(false);
    }
  }, [user]);

  return (
    <div className="flex flex-col items-center p-2">
      {isLoading ? (
        <LogoLoading />
      ) : (
        <div className="w-full">
          <div className="flex w-full justify-around gap-12 pt-10">
            <div> Your Account </div>
            <ProfileEditor userInfo={userInfo} />
          </div>
          <div className="flex w-full justify-around gap-12 pt-10">
            <div> Your Profile </div>
            <AccountEditor userInfo={userInfo} />
          </div>
        </div>
      )}
    </div>
  );
}
