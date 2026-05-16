"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import { PropertyForm } from "@/components/PropertyForm";

export default function NewPropertyPage() {
  const { tenant } = useCurrentUser();
  if (!tenant) return null;

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div>
        <Link
          href="/properties"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          物件一覧へ戻る
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">物件を追加</h1>
      </div>
      <PropertyForm tenantId={tenant.id} />
    </div>
  );
}
