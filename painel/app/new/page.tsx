import { NewPostForm } from "./form";

export default function NewPostPage() {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Novo post</h1>
        <p className="text-sm text-neutral-500">
          As imagens serão renomeadas para <code className="font-mono">01.jpg</code>,{" "}
          <code className="font-mono">02.jpg</code>… na ordem de upload.
        </p>
      </div>
      <NewPostForm defaultDate={today} />
    </div>
  );
}
