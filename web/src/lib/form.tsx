"use client";

import { useState } from "react";
import { Callout, Text } from "@radix-ui/themes";

export function Form({
  children,
  action,
}: {
  children: React.ReactNode;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      action={async (formData) => {
        const result = await action(formData);
        setError(result.error);
      }}
    >
      {error && (
        <Callout.Root color="red" size="1" mb="3">
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}
      {children}
    </form>
  );
}

export interface ActionResult {
  error: string | null;
}
