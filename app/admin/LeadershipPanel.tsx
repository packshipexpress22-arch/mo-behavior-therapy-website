"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

// Admin UI for the Clinical Leadership roster shown on /about — added
// 2026-10-14 at the user's request ("dame una opcion donde pueda agregar
// personas al clinical leadership"). Lets the admin add/edit/remove people
// (name, title, bio, photo) without any code change or redeploy — see
// lib/leadership.ts / lib/leadershipPhotos.ts for the backing data layer,
// and app/[locale]/about/page.tsx for where this shows up publicly.

type Person = {
  id: string;
  name: string;
  title: string;
  bio: string | null;
  photoKey: string | null;
  photoUrl: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

type DraftState = {
  id: string | null; // null while creating a new person
  name: string;
  title: string;
  bio: string;
  photoKey: string | null;
  photoUrl: string | null;
};

const EMPTY_DRAFT: DraftState = { id: null, name: "", title: "", bio: "", photoKey: null, photoUrl: null };

export default function LeadershipPanel() {
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draft, setDraft] = useState<DraftState | null>(null); // null = form closed
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPeople = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/leadership");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (res.status === 503) {
        setLoadError("La lista de Clinical Leadership no está configurada todavía para este entorno.");
        setPeople([]);
        return;
      }
      if (!res.ok) {
        setLoadError("No se pudo cargar la lista. Intenta de nuevo.");
        return;
      }
      const data = (await res.json()) as { people: Person[] };
      setPeople(data.people);
    } catch {
      setLoadError("No se pudo cargar la lista. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchPeople();
  }, [fetchPeople]);

  function openCreate() {
    setFormError(null);
    setDraft({ ...EMPTY_DRAFT });
  }

  function openEdit(person: Person) {
    setFormError(null);
    setDraft({
      id: person.id,
      name: person.name,
      title: person.title,
      bio: person.bio ?? "",
      photoKey: person.photoKey,
      photoUrl: person.photoUrl,
    });
  }

  function closeForm() {
    setDraft(null);
    setFormError(null);
  }

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !draft) return;
    setUploading(true);
    setFormError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/leadership/upload-photo", { method: "POST", body: form });
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setFormError(
          data?.error === "unsupported_type" || data?.error === "invalid_image"
            ? "Formato no soportado — usa una foto JPG, PNG o WebP."
            : data?.error === "file_too_large"
              ? "La foto es demasiado grande (máximo 8 MB)."
              : "No se pudo subir la foto. Intenta de nuevo."
        );
        return;
      }
      const data = (await res.json()) as { photoKey: string; photoUrl: string };
      setDraft((d) => (d ? { ...d, photoKey: data.photoKey, photoUrl: data.photoUrl } : d));
    } catch {
      setFormError("No se pudo subir la foto. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!draft) return;
    if (!draft.name.trim()) {
      setFormError("El nombre es obligatorio.");
      return;
    }
    if (!draft.title.trim()) {
      setFormError("El puesto/título es obligatorio.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const isCreate = draft.id === null;
      const url = isCreate ? "/api/admin/leadership" : `/api/admin/leadership/${draft.id}`;
      const method = isCreate ? "POST" : "PATCH";
      const body: Record<string, unknown> = {
        name: draft.name.trim(),
        title: draft.title.trim(),
        bio: draft.bio.trim() || null,
      };
      if (isCreate) {
        body.photoKey = draft.photoKey;
        body.order = people.length;
      } else if (draft.photoKey !== undefined) {
        body.photoKey = draft.photoKey; // may be null (removed) or unchanged/new key
      }

      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (!res.ok) {
        setFormError("No se pudo guardar. Intenta de nuevo.");
        return;
      }
      closeForm();
      await fetchPeople();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/leadership/${id}`, { method: "DELETE" });
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      setPeople((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setSaving(false);
      setConfirmDeleteId(null);
    }
  }

  async function move(person: Person, direction: -1 | 1) {
    const sorted = [...people].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((p) => p.id === person.id);
    const swapWith = sorted[idx + direction];
    if (!swapWith) return;
    setReorderingId(person.id);
    try {
      await Promise.all([
        fetch(`/api/admin/leadership/${person.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ order: swapWith.order }),
        }),
        fetch(`/api/admin/leadership/${swapWith.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ order: person.order }),
        }),
      ]);
      await fetchPeople();
    } finally {
      setReorderingId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-500">
          Las personas que aparecen en la sección "Clinical Leadership" de la página About. Los cambios aquí se
          reflejan en el sitio público de inmediato, sin necesidad de un nuevo despliegue.
        </p>
        <button
          onClick={openCreate}
          className="rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-white"
        >
          + Agregar persona
        </button>
      </div>

      {loadError && (
        <div className="mb-4 rounded-xl border border-brand-coral/30 bg-brand-coral/10 p-3 text-sm text-brand-coral">
          {loadError}
        </div>
      )}

      {loading && !loadError && <p className="text-sm text-ink-500">Cargando…</p>}

      {!loading && !loadError && people.length === 0 && (
        <p className="text-sm text-ink-500">
          Todavía no hay nadie agregado aquí — la página About muestra el contenido por defecto mientras tanto.
        </p>
      )}

      {!loading && people.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {people.map((person, idx) => (
            <div key={person.id} className="rounded-xl3 border border-ink-100 bg-white p-5">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-ink-100">
                  {person.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={person.photoUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-semibold text-ink-900">{person.name}</h3>
                  <p className="text-sm text-ink-500">{person.title}</p>
                  {person.bio && <p className="mt-1 line-clamp-2 text-xs text-ink-500">{person.bio}</p>}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => move(person, -1)}
                  disabled={idx === 0 || reorderingId !== null}
                  className="rounded-full border border-ink-100 px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-brand-blue hover:text-brand-blue disabled:opacity-40"
                >
                  ↑ Subir
                </button>
                <button
                  onClick={() => move(person, 1)}
                  disabled={idx === people.length - 1 || reorderingId !== null}
                  className="rounded-full border border-ink-100 px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-brand-blue hover:text-brand-blue disabled:opacity-40"
                >
                  ↓ Bajar
                </button>
                <button
                  onClick={() => openEdit(person)}
                  className="rounded-full border border-ink-100 px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-brand-blue hover:text-brand-blue"
                >
                  Editar
                </button>
                {confirmDeleteId === person.id ? (
                  <>
                    <span className="text-xs text-ink-500">¿Eliminar?</span>
                    <button
                      onClick={() => handleDelete(person.id)}
                      disabled={saving}
                      className="rounded-full bg-brand-coral px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs font-medium text-ink-500 hover:underline"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(person.id)}
                    className="ml-auto rounded-full border border-brand-coral px-3 py-1.5 text-xs font-semibold text-brand-coral hover:bg-brand-coral/10"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl3 bg-white p-6 shadow-soft">
            <h3 className="text-lg font-semibold text-ink-900">
              {draft.id ? "Editar persona" : "Agregar persona"}
            </h3>

            <div className="mt-4 flex items-center gap-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-ink-100">
                {draft.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.photoUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  disabled={uploading}
                  className="block text-xs text-ink-500"
                />
                {uploading && <p className="mt-1 text-xs text-ink-500">Subiendo…</p>}
                {draft.photoKey && !uploading && (
                  <button
                    onClick={() => setDraft((d) => (d ? { ...d, photoKey: null, photoUrl: null } : d))}
                    className="mt-1 text-xs font-medium text-brand-coral hover:underline"
                  >
                    Quitar foto
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-ink-500" htmlFor="lp-name">
                Nombre completo
              </label>
              <input
                id="lp-name"
                value={draft.name}
                onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                className="w-full rounded-xl border border-ink-100 px-3 py-2 text-sm outline-none focus-visible:border-brand-blue"
              />
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-ink-500" htmlFor="lp-title">
                Puesto / título (ej. "Lead Analyst, BCBA")
              </label>
              <input
                id="lp-title"
                value={draft.title}
                onChange={(e) => setDraft((d) => (d ? { ...d, title: e.target.value } : d))}
                className="w-full rounded-xl border border-ink-100 px-3 py-2 text-sm outline-none focus-visible:border-brand-blue"
              />
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-ink-500" htmlFor="lp-bio">
                Biografía (opcional)
              </label>
              <textarea
                id="lp-bio"
                rows={3}
                value={draft.bio}
                onChange={(e) => setDraft((d) => (d ? { ...d, bio: e.target.value } : d))}
                className="w-full rounded-xl border border-ink-100 px-3 py-2 text-sm outline-none focus-visible:border-brand-blue"
              />
            </div>

            {formError && <p className="mt-3 text-sm text-brand-coral">{formError}</p>}

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || uploading}
                className="rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
              <button
                onClick={closeForm}
                disabled={saving}
                className="text-sm font-medium text-ink-500 hover:underline"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
