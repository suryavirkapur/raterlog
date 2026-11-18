import { OverlayToaster, Position, type Toaster, type ToastProps } from "@blueprintjs/core";

let toasterPromise: Promise<Toaster> | null = null;
function getToaster() {
  toasterPromise ??= OverlayToaster.create({ position: Position.TOP });
  return toasterPromise;
}

/** Show a toast: toast({ message: "Saved", intent: "success", icon: "tick" }) */
export async function toast(props: ToastProps) {
  (await getToaster()).show({ timeout: 3000, ...props });
}

export function toastError(err: unknown, fallback = "Something went wrong") {
  return toast({
    message: err instanceof Error ? err.message : fallback,
    intent: "danger",
    icon: "error",
  });
}
