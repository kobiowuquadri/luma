import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-luma py-20">
      <h1 className="text-[2.6rem] leading-tight">Page not found</h1>
      <p className="mt-4 text-lg">
        That page does not exist. <Link href="/">Go to the LUMA home page</Link>.
      </p>
    </div>
  );
}
