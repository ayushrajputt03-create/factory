import { useEffect, useMemo, useRef, useState } from "react";
import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { Download, FileSpreadsheet, ImagePlus, Plus, Search, Trash2, Upload } from "lucide-react";
import { catalogCategories, catalogUnits, createCatalogDraft, type CatalogDraft, type CatalogImportRow, type CatalogListing, type PriceSlab, validateCatalogDraft } from "./lib/catalog";
import { catalogImportRowToPayload, parseCatalogImport } from "./lib/catalogImport";
import { uploadCatalogPhotos, validateCatalogPhotos } from "./lib/catalogStorage";
import { firestore } from "./lib/firebaseClient";
import type { Product } from "./types";

type Props = {
  factoryId?: string;
  products: Product[];
  canEdit: boolean;
  showToast: (message: string) => void;
};

const emptySlab = (): PriceSlab => ({ minQty: 1, maxQty: null, pricePerUnit: 0 });

export function CatalogView({ factoryId, products, canEdit, showToast }: Props) {
  const [listings, setListings] = useState<CatalogListing[]>([]);
  const [draft, setDraft] = useState<CatalogDraft>(() => createCatalogDraft());
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all");
  const [saving, setSaving] = useState(false);
  const [importRows, setImportRows] = useState<CatalogImportRow[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!factoryId || !firestore) return;
    return onSnapshot(collection(firestore, "factories", factoryId, "catalogListings"), (snapshot) => {
      setListings(snapshot.docs.map((listing) => ({ id: listing.id, ...listing.data() } as CatalogListing)).sort((left, right) => right.title.localeCompare(left.title)));
    }, () => setErrors(["Catalog could not load. Sign in with your factory account and check Firestore rules."]));
  }, [factoryId]);

  const filteredListings = useMemo(() => listings.filter((listing) => {
    const matchesSearch = `${listing.title} ${listing.category}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || (statusFilter === "published" ? listing.published : !listing.published);
    return matchesSearch && matchesStatus;
  }), [listings, query, statusFilter]);

  const updateDraft = <K extends keyof CatalogDraft>(key: K, value: CatalogDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const updateSlab = (index: number, key: keyof PriceSlab, value: number | null) => setDraft((current) => ({ ...current, priceSlabs: current.priceSlabs.map((slab, slabIndex) => slabIndex === index ? { ...slab, [key]: value } : slab) }));

  const saveListing = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = [...validateCatalogDraft(draft), ...validateCatalogPhotos(files)];
    setErrors(nextErrors);
    if (nextErrors.length || !factoryId || !firestore || !canEdit) return;
    setSaving(true);
    try {
      const listing = await addDoc(collection(firestore, "factories", factoryId, "catalogListings"), {
        ...draft,
        title: draft.title.trim(),
        description: draft.description.trim(),
        titleLower: draft.title.trim().toLowerCase(),
        keywords: [...new Set(`${draft.title} ${draft.category} ${draft.description}`.toLowerCase().match(/[a-z0-9]+/g) ?? [])].slice(0, 30),
        photos: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const photos = files.length ? await uploadCatalogPhotos(factoryId, listing.id, files) : [];
      if (photos.length) await updateDoc(listing, { photos, updatedAt: serverTimestamp() });
      setDraft(createCatalogDraft());
      setFiles([]);
      setErrors([]);
      showToast(draft.published ? "Listing published to the marketplace." : "Catalog draft saved.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Catalog listing could not be saved."]);
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (listing: CatalogListing) => {
    if (!firestore || !factoryId || !canEdit) return;
    try {
      await updateDoc(doc(firestore, "factories", factoryId, "catalogListings", listing.id), { published: !listing.published, updatedAt: serverTimestamp() });
      showToast(listing.published ? "Listing unpublished." : "Listing published.");
    } catch {
      setErrors(["Publish status could not be changed. Check your factory permissions."]);
    }
  };

  const parseImport = async (file?: File) => {
    if (!file) return;
    try {
      const rows = await parseCatalogImport(file);
      setImportRows(rows);
      setErrors([]);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Import file could not be read."]);
    }
  };

  const importValidRows = async () => {
    const validRows = importRows.filter((row) => row.errors.length === 0);
    const database = firestore;
    if (!database || !factoryId || !canEdit || !validRows.length) return;
    setSaving(true);
    try {
      const batch = writeBatch(database);
      validRows.forEach((row) => {
        const listing = doc(collection(database, "factories", factoryId, "catalogListings"));
        batch.set(listing, { ...catalogImportRowToPayload(row), photos: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      });
      await batch.commit();
      setImportRows([]);
      showToast(`${validRows.length} catalog listings imported.`);
    } catch {
      setErrors(["Catalog import failed. Check your permissions and retry."]);
    } finally {
      setSaving(false);
    }
  };

  return <div className="catalog-page">
    <div className="catalog-hero">
      <div><span className="eyebrow">MARKETPLACE READY</span><h2>Selling Catalog</h2><p>Publish factory products with buyer-safe pricing, lead times and product information.</p></div>
      <div className="catalog-hero-actions"><button className="btn-outline" type="button" onClick={() => importInput.current?.click()} disabled={!canEdit}><FileSpreadsheet size={16} /> Import CSV / Excel</button><button className="btn-primary" type="button" onClick={() => document.getElementById("catalog-title")?.focus()} disabled={!canEdit}><Plus size={16} /> New listing</button></div>
    </div>
    {!factoryId && <div className="catalog-notice">Set <code>VITE_FACTORY_ID</code> after Firebase Auth is enabled to connect this catalog to a factory.</div>}
    {!canEdit && <div className="catalog-notice">Only an Owner or Plant Manager can create, import or publish listings.</div>}
    {errors.length > 0 && <div className="catalog-errors" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div>}

    <div className="catalog-grid">
      <section className="panel catalog-form-panel">
        <div className="panel-header"><div className="panel-title"><h3>New product listing</h3><p>Buyer-facing information only. Internal costs and BOM data remain private.</p></div><span className="badge badge-blue">Draft</span></div>
        <form className="catalog-form" onSubmit={saveListing}>
          <label>Product title<input id="catalog-title" className="form-control" maxLength={120} value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} placeholder="e.g. Heavy-duty storage crate" disabled={!canEdit} required /></label>
          <label>Description<textarea className="form-control catalog-textarea" maxLength={2000} value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} placeholder="Describe product material, use case and available customisation." disabled={!canEdit} required /></label>
          <div className="form-two-col"><label>Category<select className="form-control" value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} disabled={!canEdit}>{catalogCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Internal product link <select className="form-control" value={draft.internalProductId ?? ""} onChange={(event) => updateDraft("internalProductId", event.target.value || undefined)} disabled={!canEdit}><option value="">No BOM product linked</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label></div>
          <div className="form-three-col"><label>MOQ<input className="form-control" type="number" min="1" value={draft.moq} onChange={(event) => updateDraft("moq", Number(event.target.value))} disabled={!canEdit} /></label><label>Unit<select className="form-control" value={draft.unit} onChange={(event) => updateDraft("unit", event.target.value)} disabled={!canEdit}>{catalogUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></label><label>GST %<input className="form-control" type="number" min="0" max="28" value={draft.gst} onChange={(event) => updateDraft("gst", Number(event.target.value))} disabled={!canEdit} /></label></div>
          <div className="form-two-col"><label>Lead time (days)<input className="form-control" type="number" min="0" max="365" value={draft.leadTimeDays} onChange={(event) => updateDraft("leadTimeDays", Number(event.target.value))} disabled={!canEdit} /></label><label className="catalog-toggle-label"><span>Marketplace status</span><button type="button" className={`catalog-toggle ${draft.published ? "on" : ""}`} aria-pressed={draft.published} onClick={() => updateDraft("published", !draft.published)} disabled={!canEdit}>{draft.published ? "Published" : "Draft"}</button></label></div>
          <div className="catalog-slab-section"><div className="catalog-section-heading"><div><strong>Price slabs</strong><small>Quantity ranges cannot overlap.</small></div><button type="button" className="btn-outline btn-sm" onClick={() => updateDraft("priceSlabs", [...draft.priceSlabs, emptySlab()])} disabled={!canEdit}><Plus size={14} /> Add slab</button></div>{draft.priceSlabs.map((slab, index) => <div className="catalog-slab" key={index}><label>From<input className="form-control" type="number" min="1" value={slab.minQty} onChange={(event) => updateSlab(index, "minQty", Number(event.target.value))} disabled={!canEdit} /></label><label>To<input className="form-control" type="number" min="1" placeholder="No limit" value={slab.maxQty ?? ""} onChange={(event) => updateSlab(index, "maxQty", event.target.value ? Number(event.target.value) : null)} disabled={!canEdit} /></label><label>₹ / {draft.unit}<input className="form-control" type="number" min="1" value={slab.pricePerUnit || ""} onChange={(event) => updateSlab(index, "pricePerUnit", Number(event.target.value))} disabled={!canEdit} /></label>{draft.priceSlabs.length > 1 && <button type="button" className="icon-button catalog-delete" aria-label={`Remove price slab ${index + 1}`} onClick={() => updateDraft("priceSlabs", draft.priceSlabs.filter((_, slabIndex) => slabIndex !== index))} disabled={!canEdit}><Trash2 size={15} /></button>}</div>)}</div>
          <div className="catalog-photo-section"><div className="catalog-section-heading"><div><strong>Product photos</strong><small>Up to 6 JPG, PNG or WebP files · maximum 5 MB each.</small></div></div><input ref={fileInput} hidden type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { const selected = Array.from(event.target.files ?? []).slice(0, 6); setFiles(selected); setErrors(validateCatalogPhotos(selected)); }} disabled={!canEdit} /> <button type="button" className="catalog-upload" onClick={() => fileInput.current?.click()} disabled={!canEdit}><ImagePlus size={20} /><span>{files.length ? `${files.length} photo${files.length > 1 ? "s" : ""} ready to upload` : "Choose product photos"}</span></button></div>
          <button className="btn-primary catalog-save" type="submit" disabled={!canEdit || saving || !factoryId}>{saving ? "Saving…" : <><Upload size={16} /> Save listing</>}</button>
        </form>
      </section>

      <section className="panel catalog-list-panel">
        <div className="panel-header"><div className="panel-title"><h3>Catalog listings</h3><p>{listings.length} product{listings.length === 1 ? "" : "s"} in this factory catalog.</p></div></div>
        <div className="catalog-list-tools"><div className="finance-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or category" /></div><select className="form-control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">All status</option><option value="published">Published</option><option value="draft">Drafts</option></select></div>
        <div className="catalog-list">{filteredListings.length === 0 ? <div className="catalog-empty"><Upload size={22} /><strong>No listings found</strong><span>Create a listing or import your catalog file to begin.</span></div> : filteredListings.map((listing) => <article className="catalog-listing" key={listing.id}><div className="catalog-thumbnail">{listing.photos[0] ? <img src={listing.photos[0]} alt="" /> : <ImagePlus size={20} />}</div><div className="catalog-listing-copy"><div><h4>{listing.title}</h4><span>{listing.category} · MOQ {listing.moq} {listing.unit}</span></div><div className="catalog-listing-meta"><span className={`badge ${listing.published ? "badge-success" : "badge-gray"}`}>{listing.published ? "Published" : "Draft"}</span><strong>From ₹{listing.priceSlabs?.[0]?.pricePerUnit?.toLocaleString("en-IN") ?? "—"}</strong></div></div><button className="btn-outline btn-sm" onClick={() => togglePublished(listing)} disabled={!canEdit}>{listing.published ? "Unpublish" : "Publish"}</button></article>)}</div>
      </section>
    </div>

    <input ref={importInput} hidden type="file" accept=".csv,.xlsx,.xls" onChange={(event) => void parseImport(event.target.files?.[0])} />
    {importRows.length > 0 && <section className="panel catalog-import-panel"><div className="panel-header"><div className="panel-title"><h3>Import preview</h3><p>{importRows.filter((row) => !row.errors.length).length} ready · {importRows.filter((row) => row.errors.length).length} need correction</p></div><div className="detail-drawer-actions"><button className="btn-outline btn-sm" onClick={() => setImportRows([])}>Discard</button><button className="btn-primary btn-sm" onClick={() => void importValidRows()} disabled={saving || !canEdit || !importRows.some((row) => !row.errors.length)}><Download size={14} /> Import valid rows</button></div></div><div className="table-container"><table><thead><tr><th>Row</th><th>Title</th><th>Category</th><th>Price</th><th>Status</th></tr></thead><tbody>{importRows.map((row) => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.title || "—"}</td><td>{row.category || "—"}</td><td>₹{row.priceSlabs[0].pricePerUnit || "—"}</td><td>{row.errors.length ? <span className="catalog-row-errors">{row.errors.join(" ")}</span> : <span className="badge badge-success">Ready</span>}</td></tr>)}</tbody></table></div></section>}
  </div>;
}
