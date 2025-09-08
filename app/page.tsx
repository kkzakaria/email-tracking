import { redirect } from "next/navigation";

export default async function Home() {
  // Rediriger vers la page de maintenance pendant la refonte
  redirect("/maintenance");
}