import type { Metadata } from "next";
import { RecycleHub } from "./RecycleHub";

export const metadata: Metadata = {
  title: "RecycleHub | ระบบจัดการศูนย์รีไซเคิล",
  description:
    "ระบบติดตามงานขนส่งและตรวจสอบวัสดุคงเหลือก่อนยืนยันคำสั่งซื้อ",
};

export default function Home() {
  return <RecycleHub />;
}
