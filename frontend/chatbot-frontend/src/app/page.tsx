"use client";
import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem("jwt");
    router.replace(token ? "/chat" : "/login");
  }, [router]);
  return null;
}