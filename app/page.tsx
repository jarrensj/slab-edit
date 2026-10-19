import { SlabEditor } from "@/components/SlabEditor";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 overflow-x-clip px-4 py-8 text-center">
      <div>
        <h1>slab edit</h1>
        <p>
          Block out the serial numbers on your slabs and/or apply a watermark to
          your inventory before you share.
        </p>
      </div>
      <SlabEditor />
    </main>
  );
}
