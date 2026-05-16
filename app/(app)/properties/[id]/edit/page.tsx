"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useCurrentUser } from "@/lib/auth";
import { getProperty } from "@/lib/store";
import type { Property } from "@/lib/types";
import { PropertyForm } from "@/components/PropertyForm";

export default function EditPropertyPage() {
  const params = useParams<{ id: string }>();
  const { tenant } = useCurrentUser();
  const [property, setProperty] = useState<Property | null>(null);

  useEffect(() => {
    const sync = () => {
      const p = getProperty(params.id);
      setProperty(p ?? null);
    };
    sync();
    window.addEventListener("bukkenlink:dbchange", sync);
    return () => window.removeEventListener("bukkenlink:dbchange", sync);
  }, [params.id]);

  if (!tenant || !property) return null;

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div>
        <Link
          href={`/properties/${property.id}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          物件詳細へ戻る
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">物件を編集</h1>
      </div>
      <PropertyForm tenantId={tenant.id} property={property} />
    </div>
  );
}
