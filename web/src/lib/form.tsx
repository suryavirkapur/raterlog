"use client";

import { useFormState } from "react-dom";
import { Callout, Text } from "@radix-ui/themes";

export function Form({
  children,
  action,
}: {
  children: React.ReactNode;
  action: (prevState: any, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction] = useFormState(action, {
    error: null,
  });
  return (
    <form action={formAction}>
      {state.error && (
        <Callout.Root color="red" size="1" mb="3">
          <Callout.Text>{state.error}</Callout.Text>
        </Callout.Root>
      )}
      {children}
    </form>
  );
}

export interface ActionResult {
  error: string | null;
}
