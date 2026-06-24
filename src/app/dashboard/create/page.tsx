import type { Metadata } from "next";
import { CreatorStudio } from "@/components/creator/CreatorStudio";
export const metadata: Metadata = { title: "Create Collection" };
export default function CreatePage() { return <CreatorStudio />; }
