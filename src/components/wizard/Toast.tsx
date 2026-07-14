"use client";

interface ToastProps {
  message: string;
  visible: boolean;
}

export function Toast({ message, visible }: ToastProps) {
  return (
    <div className={`toast${visible ? " show" : ""}`}>
      <i className="ti ti-check" />
      <span>{message}</span>
    </div>
  );
}
