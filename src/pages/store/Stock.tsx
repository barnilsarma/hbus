import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import styles from './Stock.module.scss';

type Location = {
  _id: string;
  name: string;
};

type RawMaterial = {
  _id: string;
  mcode: string;
  name: string;
  ordered: number;
  stock: number;
  gst: number;
  rate: number;
  location?: Location | string;
};

type RawMaterialForm = {
  mcode: string;
  name: string;
  ordered: string;
  stock: string;
  gst: string;
  rate: string;
};

const emptyRawMaterialForm: RawMaterialForm = {
  mcode: '',
  name: '',
  ordered: '0',
  stock: '0',
  gst: '0',
  rate: '0',
};

type Product = {
  _id: string;
  name: string;
  ready: number;
  repairing: number;
  defective: number;
  location?: Location | string;
  rawMaterials?: ProductRawMaterial[];
};

type ProductRawMaterial = {
  name: Pick<RawMaterial, '_id' | 'mcode' | 'name'> | string;
  units: number;
};

type ProductFormRawMaterial = {
  name: string;
  units: string;
};

type ProductForm = {
  name: string;
  ready: string;
  repairing: string;
  defective: string;
  rawMaterials: ProductFormRawMaterial[];
};

const emptyProductForm: ProductForm = {
  name: '',
  ready: '0',
  repairing: '0',
  defective: '0',
  rawMaterials: [],
};

const getResponseData = (response: unknown): unknown => {
  if (!response || typeof response !== 'object' || !('data' in response)) return response;
  const data = (response as { data: unknown }).data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const envelope = data as Record<string, unknown>;
  return envelope.data ?? envelope.rawMaterials ?? envelope.primaries ?? envelope.locations ?? data;
};

const getLocationName = (location: Location | string | undefined, fallback: string) => {
  if (location && typeof location === 'object') return location.name || fallback;
  return fallback;
};

export default function Stock() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [isAdmin] = useState(() => {
    const storedUser = localStorage.getItem('user');
    let user: { type?: string; role?: string } | null = null;
    if (storedUser) {
      try {
        user = JSON.parse(storedUser) as { type?: string; role?: string };
      } catch (error) {
        console.error('Error reading stored user:', error);
      }
    }
    return (
      localStorage.getItem('hbus_user_role') ||
      localStorage.getItem('user_type') ||
      user?.type ||
      user?.role ||
      ''
    ).trim().toUpperCase() === 'A';
  });
  const [selectedLocationId, setSelectedLocationId] = useState(() => {
    const storedLocationId = localStorage.getItem('hbus_selected_location_id') || '';
    return isAdmin || storedLocationId === 'ALL' ? '' : storedLocationId;
  });
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRawMaterialFormOpen, setIsRawMaterialFormOpen] = useState(false);
  const [rawMaterialForm, setRawMaterialForm] = useState<RawMaterialForm>(emptyRawMaterialForm);
  const [editingRawMaterialId, setEditingRawMaterialId] = useState<string | null>(null);
  const [savingRawMaterial, setSavingRawMaterial] = useState(false);
  const [deletingRawMaterialId, setDeletingRawMaterialId] = useState<string | null>(null);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    const savedLocationId = localStorage.getItem('hbus_selected_location_id') || '';
    axios.get(`${import.meta.env.VITE_APP_API}/api/location`)
      .then((response) => {
        const result = getResponseData(response);
        const available = Array.isArray(result) ? result as Location[] : [];
        setLocations(available);
        const selected = available.some((location) => location._id === savedLocationId)
          ? savedLocationId
          : available[0]?._id || '';
        setSelectedLocationId(selected);
        if (selected) localStorage.setItem('hbus_selected_location_id', selected);
      })
      .catch((error) => {
        console.error('Error fetching locations:', error);
        toast.error('Failed to load locations.');
      });
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedLocationId) return;

    let cancelled = false;
    const loadStock = async () => {
      setLoading(true);
      try {
        const [rawResponse, productResponse] = await Promise.all([
          axios.get(`${import.meta.env.VITE_APP_API}/api/rawmaterials/location/${selectedLocationId}`),
          axios.get(`${import.meta.env.VITE_APP_API}/api/primaries/location/${selectedLocationId}`),
        ]);
        const rawResult = getResponseData(rawResponse);
        const productResult = getResponseData(productResponse);
        if (!cancelled) {
          setRawMaterials(Array.isArray(rawResult) ? rawResult as RawMaterial[] : []);
          setProducts(Array.isArray(productResult) ? productResult as Product[] : []);
        }
      } catch (error) {
        console.error('Error loading stock records:', error);
        toast.error('Failed to load stock records.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadStock();
    return () => {
      cancelled = true;
    };
  }, [selectedLocationId]);

  const changeLocation = (locationId: string) => {
    setSelectedLocationId(locationId);
    localStorage.setItem('hbus_selected_location_id', locationId);
    setLoading(Boolean(locationId));
    setRawMaterials([]);
    setProducts([]);
  };

  const handleCreateRawMaterial = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedLocationId || !rawMaterialForm.mcode.trim() || !rawMaterialForm.name.trim()) return;

    const wasEditing = Boolean(editingRawMaterialId);
    setSavingRawMaterial(true);
    try {
      const payload = {
        mcode: rawMaterialForm.mcode.trim(),
        name: rawMaterialForm.name.trim(),
        ordered: editingRawMaterialId ? Number(rawMaterialForm.ordered) : 0,
        stock: Number(rawMaterialForm.stock),
        location: selectedLocationId,
        gst: Number(rawMaterialForm.gst),
        rate: Number(rawMaterialForm.rate),
      };
      if (editingRawMaterialId) {
        await axios.put(`${import.meta.env.VITE_APP_API}/api/rawmaterials/${editingRawMaterialId}`, payload);
      } else {
        await axios.post(`${import.meta.env.VITE_APP_API}/api/rawmaterials`, payload);
      }

      setIsRawMaterialFormOpen(false);
      setRawMaterialForm(emptyRawMaterialForm);
      setEditingRawMaterialId(null);
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_APP_API}/api/rawmaterials/location/${selectedLocationId}`,
        );
        const result = getResponseData(response);
        if (!Array.isArray(result)) throw new Error('The raw material response was not a list.');
        setRawMaterials(result as RawMaterial[]);
        toast.success(wasEditing ? 'Raw material updated successfully.' : 'Raw material added successfully.');
      } catch (error) {
        console.error('Raw material saved, but refreshing stock records failed:', error);
        toast.error('Raw material was saved, but the raw material list could not be refreshed.');
      }
    } catch (error) {
      console.error('Error saving raw material:', error);
      toast.error('Failed to save raw material. Check that the material code is unique.');
    } finally {
      setSavingRawMaterial(false);
    }
  };

  const handleCreateProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedLocationId || !productForm.name.trim()) return;

    const wasEditing = Boolean(editingProductId);
    setSavingProduct(true);
    try {
      const payload = {
        name: productForm.name.trim(),
        ready: Number(productForm.ready),
        repairing: Number(productForm.repairing),
        defective: Number(productForm.defective),
        location: selectedLocationId,
        rawMaterials: productForm.rawMaterials.map((material) => ({
          name: material.name,
          units: Number(material.units),
        })),
      };
      if (editingProductId) {
        await axios.put(`${import.meta.env.VITE_APP_API}/api/primaries/${editingProductId}`, payload);
      } else {
        await axios.post(`${import.meta.env.VITE_APP_API}/api/primaries`, payload);
      }

      setIsProductFormOpen(false);
      setProductForm(emptyProductForm);
      setEditingProductId(null);
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_APP_API}/api/primaries/location/${selectedLocationId}`,
        );
        const result = getResponseData(response);
        if (!Array.isArray(result)) throw new Error('The product response was not a list.');
        setProducts(result as Product[]);
        toast.success(wasEditing ? 'Product updated successfully.' : 'Product added successfully.');
      } catch (error) {
        console.error('Product saved, but refreshing stock records failed:', error);
        toast.error('Product was saved, but the product list could not be refreshed.');
      }
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product.');
    } finally {
      setSavingProduct(false);
    }
  };

  const toggleRawMaterial = (materialId: string) => {
    setProductForm((form) => ({
      ...form,
      rawMaterials: form.rawMaterials.some((material) => material.name === materialId)
        ? form.rawMaterials.filter((material) => material.name !== materialId)
        : [...form.rawMaterials, { name: materialId, units: '1' }],
    }));
  };

  const updateRawMaterialUnits = (materialId: string, units: string) => {
    setProductForm((form) => ({
      ...form,
      rawMaterials: form.rawMaterials.map((material) =>
        material.name === materialId ? { ...material, units } : material,
      ),
    }));
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!window.confirm(`Delete product "${product.name}"?`)) return;

    setDeletingProductId(product._id);
    try {
      await axios.delete(`${import.meta.env.VITE_APP_API}/api/primaries/${product._id}`);
      setProducts((currentProducts) => currentProducts.filter((item) => item._id !== product._id));
      toast.success('Product deleted successfully.');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product.');
    } finally {
      setDeletingProductId(null);
    }
  };

  const editRawMaterial = (material: RawMaterial) => {
    setEditingRawMaterialId(material._id);
    setRawMaterialForm({
      mcode: material.mcode,
      name: material.name,
      ordered: String(material.ordered),
      stock: String(material.stock),
      gst: String(material.gst),
      rate: String(material.rate),
    });
    setIsRawMaterialFormOpen(true);
  };

  const handleDeleteRawMaterial = async (material: RawMaterial) => {
    if (!window.confirm(`Delete raw material "${material.name}" (${material.mcode})?`)) return;

    setDeletingRawMaterialId(material._id);
    try {
      await axios.delete(`${import.meta.env.VITE_APP_API}/api/rawmaterials/${material._id}`);
      setRawMaterials((currentMaterials) => currentMaterials.filter((item) => item._id !== material._id));
      toast.success('Raw material deleted successfully.');
    } catch (error) {
      console.error('Error deleting raw material:', error);
      toast.error('Failed to delete raw material.');
    } finally {
      setDeletingRawMaterialId(null);
    }
  };

  const editProduct = (product: Product) => {
    setEditingProductId(product._id);
    setProductForm({
      name: product.name,
      ready: String(product.ready),
      repairing: String(product.repairing),
      defective: String(product.defective),
      rawMaterials: (product.rawMaterials || []).map((material) => ({
        name: typeof material.name === 'string' ? material.name : material.name._id,
        units: String(material.units),
      })),
    });
    setIsProductFormOpen(true);
  };

  return (
    <main className={styles.stockPage}>
      <header className={styles.header}>
        <div>
          <h1>Stock</h1>
          <p>Raw materials and finished product inventory.</p>
        </div>
        <div className={styles.headerActions}>
          {isAdmin && (
            <label className={styles.locationField}>
              Location
              <select value={selectedLocationId} onChange={(event) => changeLocation(event.target.value)}>
                <option value="">Select location</option>
                {locations.map((location) => (
                  <option key={location._id} value={location._id}>{location.name}</option>
                ))}
              </select>
            </label>
          )}
          <button type="button" onClick={() => navigate('/store')}>Back to Store</button>
        </div>
      </header>

      {!selectedLocationId && <p className={styles.status}>Select a location to view stock records.</p>}
      {loading && <p className={styles.status}>Loading stock records...</p>}

      <section className={styles.tableSection}>
        <div className={styles.sectionHeading}>
          <h2>Raw Materials</h2>
          <button
            type="button"
            className={styles.addProductButton}
            disabled={!selectedLocationId || loading}
            onClick={() => {
              setEditingRawMaterialId(null);
              setRawMaterialForm(emptyRawMaterialForm);
              setIsRawMaterialFormOpen(true);
            }}
          >
            Add New Raw Material
          </button>
        </div>
        <div className={styles.tableScroll}>
          <table>
            <thead>
              <tr>
                <th>Material Code</th>
                <th>Name</th>
                <th>Ordered</th>
                <th>Stock</th>
                <th>GST (%)</th>
                <th>Rate</th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rawMaterials.length === 0 ? (
                <tr><td colSpan={8} className={styles.empty}>No RawMaterial records found.</td></tr>
              ) : rawMaterials.map((material) => (
                <tr key={material._id}>
                  <td>{material.mcode}</td>
                  <td>{material.name}</td>
                  <td>{material.ordered}</td>
                  <td>{material.stock}</td>
                  <td>{material.gst}</td>
                  <td>{material.rate}</td>
                  <td>{getLocationName(material.location, locations.find((loc) => loc._id === selectedLocationId)?.name || selectedLocationId)}</td>
                  <td>
                    <div className={styles.recordActions}>
                      <button
                        type="button"
                        className={styles.editRecordButton}
                        disabled={deletingRawMaterialId !== null}
                        onClick={() => editRawMaterial(material)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={styles.deleteProductButton}
                        disabled={deletingRawMaterialId !== null}
                        onClick={() => void handleDeleteRawMaterial(material)}
                      >
                        {deletingRawMaterialId === material._id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.tableSection}>
        <div className={styles.sectionHeading}>
          <h2>Products</h2>
          <button
            type="button"
            className={styles.addProductButton}
            disabled={!selectedLocationId || loading}
            onClick={() => {
              setEditingProductId(null);
              setProductForm(emptyProductForm);
              setIsProductFormOpen(true);
            }}
          >
            Add New Product
          </button>
        </div>
        <div className={styles.tableScroll}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Ready</th>
                <th>Repairing</th>
                <th>Defective</th>
                <th>Raw Materials</th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && products.length === 0 ? (
                <tr><td colSpan={7} className={styles.empty}>No Primary product records found.</td></tr>
              ) : products.map((product) => (
                <tr key={product._id}>
                  <td>{product.name}</td>
                  <td>{product.ready}</td>
                  <td>{product.repairing}</td>
                  <td>{product.defective}</td>
                  <td>
                    {product.rawMaterials?.length ? (
                      <ul className={styles.productMaterialList}>
                        {product.rawMaterials.map((material, index) => {
                          const reference = material.name;
                          const referenceId = typeof reference === 'string' ? reference : reference._id;
                          const details = typeof reference === 'string'
                            ? rawMaterials.find((item) => item._id === reference)
                            : reference;
                          const label = details
                            ? `${details.mcode} - ${details.name}`
                            : referenceId;

                          return (
                            <li key={`${referenceId}-${index}`}>
                              <span>{label}</span>
                              <span className={styles.materialUnits}>Units: {material.units}</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : '-'}
                  </td>
                  <td>{getLocationName(product.location, locations.find((loc) => loc._id === selectedLocationId)?.name || selectedLocationId)}</td>
                  <td>
                    <div className={styles.recordActions}>
                      <button
                        type="button"
                        className={styles.editRecordButton}
                      disabled={deletingProductId !== null}
                        onClick={() => editProduct(product)}
                    >
                        Edit
                    </button>
                      <button
                        type="button"
                        className={styles.deleteProductButton}
                        aria-label={`Delete ${product.name}`}
                        disabled={deletingProductId !== null}
                        onClick={() => void handleDeleteProduct(product)}
                      >
                        {deletingProductId === product._id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isRawMaterialFormOpen && (
        <div className={styles.modalBackdrop}>
          <section
            className={styles.productModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-raw-material-title"
          >
            <div className={styles.modalHeading}>
              <h2 id="add-raw-material-title">{editingRawMaterialId ? 'Edit Raw Material' : 'Add New Raw Material'}</h2>
              <button
                type="button"
                className={styles.closeButton}
                aria-label="Close form"
                disabled={savingRawMaterial}
                onClick={() => {
                  setIsRawMaterialFormOpen(false);
                  setEditingRawMaterialId(null);
                }}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateRawMaterial}>
              <label className={styles.formField}>
                Material Code
                <input
                  type="text"
                  value={rawMaterialForm.mcode}
                  required
                  onChange={(event) => setRawMaterialForm({ ...rawMaterialForm, mcode: event.target.value })}
                />
              </label>
              <label className={styles.formField}>
                Name
                <input
                  type="text"
                  value={rawMaterialForm.name}
                  maxLength={100}
                  required
                  onChange={(event) => setRawMaterialForm({ ...rawMaterialForm, name: event.target.value })}
                />
              </label>
              <div className={styles.quantityFields}>
                {editingRawMaterialId && (
                  <label className={styles.formField}>
                    Ordered
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={rawMaterialForm.ordered}
                      onChange={(event) => setRawMaterialForm({ ...rawMaterialForm, ordered: event.target.value })}
                    />
                  </label>
                )}
                <label className={styles.formField}>
                  Initial Stock
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={rawMaterialForm.stock}
                    onChange={(event) => setRawMaterialForm({ ...rawMaterialForm, stock: event.target.value })}
                  />
                </label>
                <label className={styles.formField}>
                  GST (%)
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={rawMaterialForm.gst}
                    onChange={(event) => setRawMaterialForm({ ...rawMaterialForm, gst: event.target.value })}
                  />
                </label>
                <label className={styles.formField}>
                  Rate
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={rawMaterialForm.rate}
                    onChange={(event) => setRawMaterialForm({ ...rawMaterialForm, rate: event.target.value })}
                  />
                </label>
              </div>
              <p className={styles.locationSummary}>
                {editingRawMaterialId ? null : 'Ordered: 0 · '}
                Location: {locations.find((location) => location._id === selectedLocationId)?.name || selectedLocationId}
              </p>
              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  disabled={savingRawMaterial}
                  onClick={() => {
                    setIsRawMaterialFormOpen(false);
                    setEditingRawMaterialId(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.submitButton} disabled={savingRawMaterial}>
                  {savingRawMaterial ? 'Saving...' : editingRawMaterialId ? 'Save Changes' : 'Add Raw Material'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isProductFormOpen && (
        <div className={styles.modalBackdrop}>
          <section
            className={styles.productModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-product-title"
          >
            <div className={styles.modalHeading}>
              <h2 id="add-product-title">{editingProductId ? 'Edit Product' : 'Add New Product'}</h2>
              <button
                type="button"
                className={styles.closeButton}
                aria-label="Close form"
                disabled={savingProduct}
                onClick={() => {
                  setIsProductFormOpen(false);
                  setEditingProductId(null);
                }}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateProduct}>
              <label className={styles.formField}>
                Name
                <input
                  type="text"
                  value={productForm.name}
                  maxLength={100}
                  required
                  onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                />
              </label>
              <div className={styles.quantityFields}>
                <label className={styles.formField}>
                  Ready
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={productForm.ready}
                    onChange={(event) => setProductForm({ ...productForm, ready: event.target.value })}
                  />
                </label>
                <label className={styles.formField}>
                  Repairing
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={productForm.repairing}
                    onChange={(event) => setProductForm({ ...productForm, repairing: event.target.value })}
                  />
                </label>
                <label className={styles.formField}>
                  Defective
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={productForm.defective}
                    onChange={(event) => setProductForm({ ...productForm, defective: event.target.value })}
                  />
                </label>
              </div>
              <fieldset className={styles.materialField}>
                <legend>Raw Materials</legend>
                <span className={styles.fieldHint}>Select all raw materials associated with this product.</span>
                {rawMaterials.length ? (
                  <div className={styles.materialList}>
                    {rawMaterials.map((material) => {
                      const selectedMaterial = productForm.rawMaterials.find(
                        (entry) => entry.name === material._id,
                      );

                      return (
                        <div key={material._id} className={styles.materialOption}>
                          <label className={styles.materialCheckbox}>
                            <input
                              type="checkbox"
                              checked={Boolean(selectedMaterial)}
                              onChange={() => toggleRawMaterial(material._id)}
                            />
                            <span>{material.mcode} - {material.name}</span>
                          </label>
                          {selectedMaterial && (
                            <label className={styles.materialUnitsInput}>
                              Units
                              <input
                                type="number"
                                min="0"
                                step="any"
                                required
                                value={selectedMaterial.units}
                                aria-label={`Units of ${material.mcode} - ${material.name}`}
                                onChange={(event) => updateRawMaterialUnits(material._id, event.target.value)}
                              />
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className={styles.noMaterials}>No raw materials are available for this location.</p>
                )}
              </fieldset>
              <p className={styles.locationSummary}>
                Location: {locations.find((location) => location._id === selectedLocationId)?.name || selectedLocationId}
              </p>
              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  disabled={savingProduct}
                  onClick={() => {
                    setIsProductFormOpen(false);
                    setEditingProductId(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.submitButton} disabled={savingProduct}>
                  {savingProduct ? 'Saving...' : editingProductId ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
