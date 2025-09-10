import { redirect } from "next/navigation";

export default async function Home() {
  // Rediriger vers la page de connexion
  redirect("/login");
}