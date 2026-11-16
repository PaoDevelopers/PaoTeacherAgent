"use client";

import NextError from "next/error";

export default function GlobalError() {
  return (
    <html lang="en">
      <body>
        {/* NextError require  a `statusCode` prop. However, since the App Router
        does not expose status codes for errors, we simply pass 0 to render a
        generic error message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
