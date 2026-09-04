import { assertLocalPage } from "@/lib/local-only";

/**
 * Local-only gate for the whole image workbench.
 *
 * Every page under /admin/images renders through here, so one check covers the
 * tree. The API routes guard themselves separately — a 404 page with live
 * endpoints behind it would be no protection at all.
 */
export default function ImagesAdminLayout({ children }: { children: React.ReactNode }) {
  assertLocalPage();
  return <>{children}</>;
}
