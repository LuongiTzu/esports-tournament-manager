"use client";

import NextLink, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import NavigationIndicator from "./NavigationIndicator";

function LinkPendingIndicator() {
  const { pending } = useLinkStatus();
  return <NavigationIndicator pending={pending} />;
}

export default function Link({ children, ...props }: ComponentProps<typeof NextLink>) {
  return (
    <NextLink {...props}>
      {children}
      <LinkPendingIndicator />
    </NextLink>
  );
}
