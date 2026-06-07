"use client";

type PublicExitButtonProps = {
  label?: string;
};

export function PublicExitButton({ label = "Sair" }: PublicExitButtonProps) {
  return (
    <button
      className="button secondary"
      onClick={() => {
        if (typeof window === "undefined") {
          return;
        }

        if (window.history.length > 1) {
          window.history.back();
          return;
        }

        window.close();
      }}
      type="button"
    >
      {label}
    </button>
  );
}
