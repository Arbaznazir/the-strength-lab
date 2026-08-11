"use client";

import { use } from "react";
import { ConversationPanel } from "@/components/messages/ConversationPanel";

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ConversationPanel id={id} />;
}
