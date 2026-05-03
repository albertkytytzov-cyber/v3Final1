import { redirect } from "next/navigation";

export default function SignupPage() {
  redirect("/workspace?auth=register");
}
