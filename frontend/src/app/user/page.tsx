"use client";
import userService from "@/helpers/user-service/api-wrapper";
import ProfileEditor from "../../components/forms/ProfileEditor";
import AccountEditor from "../../components/forms/AccountEditor";
import LogoLoading from "@/components/common/LogoLoading";
import { useUserContext } from "@/contexts/user-context";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect } from "react";
import Cookies from "js-cookie";

export default function Page() {
  const { user } = useUserContext();
  const [isLoading, setIsLoading] = useState(false);
  const [ userInfo, setUserInfo ] = useState<UserInfo>({} as UserInfo);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        if (user === null || Cookies.get('token')) {
          toast({
            title: "You must login to see Userpage",
            description: "Please login first",
            variant: "destructive",
          });
          router.push("/login");
        } else {
          const retrievedUserInfo = await userService.getUserInfo(user.uid);
          console.log("retrieved", retrievedUserInfo);
          if (retrievedUserInfo === null) {
            toast({
              title: "Cannot fetch userpage",
              description: "Please try again later",
              variant: "destructive",
            });
            router.push("/");
          } else {
            setUserInfo(retrievedUserInfo);
          }
        }
        setIsLoading(false);
      } catch (error) { 
        console.error("Error fetching user info:", error);
        toast({
          title: "Cannot fetch userpaage",
          description: "Please try again later",
          variant: "destructive",
        });
        // Handle the error based on its type
        router.push("/");
        setIsLoading(false);
      }
    };
    if (user) {
      fetchUserInfo().catch((err) => console.log(err));
      setIsLoading(true);
    } else {
      console.log("no user context");
      setIsLoading(false);
      router.push("/");
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
            <AccountEditor uid={user?.uid || -1} userInfo={userInfo} />
          </div>
        </div>
      )}
    </div>
  );
}
