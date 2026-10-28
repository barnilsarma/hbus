import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { FaArrowLeft, FaPencilAlt, FaPlus, FaPrint, FaSearch, FaTimes, FaTrash } from 'react-icons/fa';
import styles from './POFormat.module.scss';

type LocationRef = string | { _id?: string; id?: string; name?: string; address?: string; gstn?: string };

type RawMaterial = {
  _id?: string;
  id?: string;
  mcode: string;
  name: string;
  ordered: number | string;
  stock: number | string;
  location: LocationRef;
  gst: number | string;
  rate: number | string;
};

type PurchaseOrder = {
  _id?: string;
  id?: string;
  PONumber?: string;
  date?: string;
  invoicedate?: string;
  supplier?: string;
  supplierAddress?: string;
  supplierState?: string;
  supplierStateCode?: string | number;
  gstn?: string;
  location?: LocationRef;
  rawMaterials?: Array<RawMaterial | string>;
};

type RawMaterialForm = {
  mcode: string;
  name: string;
  ordered: number | string;
  stock: number | string;
  gst: number | string;
  rate: number | string;
};

const initialForm: RawMaterialForm = {
  mcode: '',
  name: '',
  ordered: 0,
  stock: 0,
  gst: 0,
  rate: 0,
};

const getResponseData = <T,>(data: unknown): T => {
  let result = data;
  while (result && typeof result === 'object' && !Array.isArray(result)) {
    const envelope = result as Record<string, unknown>;
    const nested = envelope.data ?? envelope.rawMaterial ?? envelope.purchase;
    if (nested === undefined || nested === result) break;
    result = nested;
  }
  return result as T;
};

const getEntityId = (value: RawMaterial | string): string | null => {
  if (typeof value === 'string') return value;
  return value._id || value.id || null;
};

const getLocationId = (value: LocationRef | undefined): string | null => {
  if (typeof value === 'string') return value;
  return value?._id || value?.id || null;
};

const getLocationName = (value: LocationRef | undefined): string => {
  if (typeof value === 'string') return '-';
  return value?.name || value?.address || '-';
};

const getMaterialLocationName = (
  materialLocation: LocationRef,
  purchaseLocation: LocationRef | undefined,
  purchaseLocationName: string,
): string => {
  const materialLocationName = getLocationName(materialLocation);
  if (materialLocationName !== '-') return materialLocationName;

  const materialLocationId = getLocationId(materialLocation);
  return materialLocationId && materialLocationId === getLocationId(purchaseLocation)
    ? purchaseLocationName
    : '-';
};

const BoxedText: React.FC<{ text?: string; minLength?: number }> = ({ text = '', minLength = 0 }) => {
  const chars = text.split('');
  while (chars.length < minLength) chars.push('');

  return (
    <div className={styles.boxedGrid}>
      {chars.map((char, index) => (
        <span key={index} className={styles.box}>
          {char || '\u00A0'}
        </span>
      ))}
    </div>
  );
};

export default function PurchasePrimary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState<PurchaseOrder | null>(null);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RawMaterialForm>(initialForm);
  const [searchMcode, setSearchMcode] = useState('');
  const [foundMaterialId, setFoundMaterialId] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'found' | 'not-found'>('idle');

  const fetchPurchase = useCallback(async () => {
    if (!id) return null;
    try {
      const response = await axios.get(`${import.meta.env.VITE_APP_API}/api/raw-material-pos/${id}`);
      const purchaseData = getResponseData<PurchaseOrder>(response.data);
      const rawItems = Array.isArray(purchaseData.rawMaterials) ? purchaseData.rawMaterials : [];
      const loadedMaterials = await Promise.all(
        rawItems.map(async (item) => {
          if (typeof item !== 'string' && item.name !== undefined && item.mcode !== undefined) {
            return item;
          }
          const itemId = getEntityId(item);
          if (!itemId) throw new Error('A RawMaterial purchase line has no material ID.');
          const materialResponse = await axios.get(
            `${import.meta.env.VITE_APP_API}/api/rawmaterials/${itemId}`,
          );
          return getResponseData<RawMaterial>(materialResponse.data);
        }),
      );
      return { purchase: purchaseData, materials: loadedMaterials };
    } catch (error) {
      console.error('Error fetching RawMaterial purchase order:', error);
      toast.error('Failed to load RawMaterial purchase order.');
      return null;
    }
  }, [id]);

  useEffect(() => {
    let current = true;
    void fetchPurchase().then((result) => {
      if (!current) return;
      if (result) {
        setPurchase(result.purchase);
        setMaterials(result.materials);
      }
      setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [fetchPurchase]);

  const openAddModal = () => {
    setEditingId(null);
    setForm(initialForm);
    setSearchMcode('');
    setFoundMaterialId(null);
    setSearchStatus('idle');
    setModalOpen(true);
  };

  const openEditModal = (material: RawMaterial) => {
    setEditingId(material._id || null);
    setForm({
      mcode: material.mcode,
      name: material.name,
      ordered: material.ordered,
      stock: material.stock,
      gst: material.gst ?? 0,
      rate: material.rate ?? 0,
    });
    setSearchStatus('idle');
    setModalOpen(true);
  };

  const searchMaterial = async () => {
    if (!searchMcode.trim()) {
      toast.error('Please enter a Material Code.');
      return;
    }
    setSearchStatus('loading');
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_APP_API}/api/rawmaterials/mcode/${encodeURIComponent(searchMcode.trim())}`,
      );
      const material = getResponseData<RawMaterial>(response.data);
      if (!material?._id) throw new Error('The RawMaterial response is missing its ID.');
      setForm({
        mcode: material.mcode,
        name: material.name,
        ordered: material.ordered ?? 0,
        stock: material.stock ?? 0,
        gst: material.gst ?? 0,
        rate: material.rate ?? 0,
      });
      setFoundMaterialId(material._id);
      setSearchStatus('found');
      toast.success('Raw material found.');
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setForm({ ...initialForm, mcode: searchMcode.trim() });
        setFoundMaterialId(null);
        setSearchStatus('not-found');
        toast.info('Raw material not found. Enter its details to create it.');
      } else {
        console.error('Error searching RawMaterial:', error);
        toast.error('Failed to search RawMaterial.');
        setSearchStatus('idle');
      }
    }
  };

  const saveMaterial = async (event: React.FormEvent) => {
    event.preventDefault();
    const locationId = getLocationId(purchase?.location) ||
      localStorage.getItem('hbus_selected_location_id');
    if (!locationId || locationId === 'ALL') {
      toast.error('Select a specific location before adding RawMaterials.');
      return;
    }

    const payload = {
      mcode: form.mcode.trim(),
      name: form.name.trim(),
      ordered: Number(form.ordered),
      stock: Number(form.stock),
      gst: Number(form.gst),
      rate: Number(form.rate),
      location: locationId,
    };
    if (!payload.mcode || !payload.name || !Number.isFinite(payload.ordered) ||
      !Number.isFinite(payload.stock) || !Number.isFinite(payload.gst) ||
      !Number.isFinite(payload.rate) || payload.ordered < 0 || payload.stock < 0 ||
      payload.gst < 0 || payload.rate < 0) {
      toast.error('Enter valid RawMaterial details.');
      return;
    }

    try {
      const currentIds = (purchase?.rawMaterials || [])
        .map(getEntityId)
        .filter((itemId): itemId is string => Boolean(itemId));
      let materialId = editingId;
      if (editingId) {
        await axios.put(`${import.meta.env.VITE_APP_API}/api/rawmaterials/${editingId}`, payload);
      } else if (searchStatus === 'found') {
        materialId = foundMaterialId;
        if (!materialId) throw new Error('The selected RawMaterial does not have an ID.');
        await axios.put(`${import.meta.env.VITE_APP_API}/api/rawmaterials/${materialId}`, payload);
      } else {
        const response = await axios.post(`${import.meta.env.VITE_APP_API}/api/rawmaterials`, payload);
        const created = getResponseData<RawMaterial>(response.data);
        materialId = created._id || null;
      }

      if (!materialId) throw new Error('The saved RawMaterial does not have an ID.');
      if (!currentIds.includes(materialId)) {
        await axios.put(`${import.meta.env.VITE_APP_API}/api/raw-material-pos/${id}`, {
          rawMaterials: [...currentIds, materialId],
        });
      }
      toast.success(editingId ? 'RawMaterial updated.' : 'RawMaterial added to the PO.');
      const result = await fetchPurchase();
      if (result) {
        setPurchase(result.purchase);
        setMaterials(result.materials);
      }
      setModalOpen(false);
    } catch (error) {
      console.error('Error saving RawMaterial PO line:', error);
      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.message || 'Failed to save RawMaterial.'
          : 'Failed to save RawMaterial.',
      );
    }
  };

  const removeMaterial = async (materialId: string) => {
    if (!window.confirm('Remove this RawMaterial from the purchase order?')) return;
    try {
      await axios.delete(
        `${import.meta.env.VITE_APP_API}/api/raw-material-pos/${id}/raw-materials/${materialId}`,
      );
      toast.success('RawMaterial removed from the purchase order.');
      const result = await fetchPurchase();
      if (result) {
        setPurchase(result.purchase);
        setMaterials(result.materials);
      }
    } catch (error) {
      console.error('Error removing RawMaterial from PO:', error);
      toast.error('Failed to remove RawMaterial from the purchase order.');
    }
  };

  if (loading) return <div className={styles.loadingContainer}>Loading RawMaterial Purchase Order...</div>;
  if (!purchase) return <div className={styles.loadingContainer}>Purchase order could not be loaded.</div>;

  const date = purchase.invoicedate || purchase.date
    ? new Date(purchase.invoicedate || purchase.date || '').toLocaleDateString('en-GB')
    : '';
  const deliveryDate = purchase.invoicedate || purchase.date
    ? new Date(purchase.invoicedate || purchase.date || '')
    : null;
  deliveryDate?.setDate(deliveryDate.getDate() + 30);
  const deliveryDateText = deliveryDate && !Number.isNaN(deliveryDate.getTime())
    ? deliveryDate.toLocaleDateString('en-GB')
    : '-';
  const locationName = getLocationName(purchase.location);

  return (
    <div className={styles.pageWrapper}>
      <div className={`${styles.actionBar} ${styles.noPrint}`}>
        <button className={styles.secondaryBtn} onClick={() => navigate('/purchase-primary')}>
        <FaArrowLeft /> Back to Raw Material Purchases
        </button>
        <div className={styles.rightActions}>
          <button className={styles.primaryBtn} onClick={openAddModal}>
            <FaPlus /> Add Raw Material
          </button>
          <button className={styles.printBtn} onClick={() => window.print()}>
            <FaPrint /> Print PO
          </button>
        </div>
      </div>

      <div className={styles.poDocument}>
        <h1 className={styles.mainTitle}>RAW MATERIAL PURCHASE ORDER</h1>
        <div className={styles.headerRow}>
          <div className={styles.logoSection}>
            <img src="/assets/hbuslogo.png" alt="HBus Logo" className={styles.logo} />
          </div>
          <div className={styles.taglineSection}>
            <h2 className={styles.companyName}>
              <span>E</span>QUIPMENT <span>M</span>ANUFACTURING <span>C</span>OMPANY
            </h2>
          </div>
          <div className={styles.subTagline}>A Synonym of Excellence</div>
        </div>

        <div className={styles.metaRow}>
          <div className={styles.metaGroup}>
            <span className={styles.metaLabel}>GSTN :</span>
            <BoxedText text={purchase.location && typeof purchase.location === 'object'
              ? purchase.location.gstn || purchase.gstn || ''
              : purchase.gstn || ''} minLength={15} />
          </div>
        </div>
        <div className={styles.metaRow}>
          <div className={styles.metaGroup}>
            <span className={styles.metaLabel}>Purchase Order No</span>
            <BoxedText text={purchase.PONumber || ''} minLength={16} />
          </div>
          <div className={styles.metaGroup}>
            <span className={styles.metaLabel}>DATE :</span>
            <BoxedText text={date} minLength={10} />
          </div>
        </div>

        <div className={styles.addressGrid}>
          <div className={styles.supplierBlock}>
            <p className={styles.blockLabel}>To</p>
            <p className={styles.supplierName}>{purchase.supplier || '-'}</p>
            <p className={styles.supplierAddress}>{purchase.supplierAddress || '-'}</p>
            <div className={styles.gstnInline}>
              <span className={styles.metaLabel}>GSTIN:</span>
              <BoxedText text={purchase.gstn || ''} minLength={15} />
            </div>
            <div className={styles.stateRow}>
              <span>State : {purchase.supplierState || '-'}</span>
              <span>State Code : {purchase.supplierStateCode || '-'}</span>
            </div>
          </div>
          <div className={styles.shippingBlock}>
            <p className={styles.blockLabelUnderline}>Shipping Address</p>
            <p className={styles.shippingAddress}>{locationName}</p>
          </div>
        </div>

        <table className={styles.itemsTable}>
          <thead>
            <tr>
              <th style={{ width: '6%' }}>Sl No</th>
              <th style={{ width: '14%' }}>Material Code</th>
              <th style={{ width: '25%' }}>Material Name</th>
              <th style={{ width: '10%' }}>Ordered</th>
              <th style={{ width: '10%' }}>Stock</th>
              <th style={{ width: '8%' }}>GST (%)</th>
              <th style={{ width: '10%' }}>Rate (₹)</th>
              <th style={{ width: '9%' }}>Location</th>
              <th className={styles.noPrint} style={{ width: '8%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {materials.length ? materials.map((material, index) => (
              <tr key={material._id || `${material.mcode}-${index}`}>
                <td className={styles.textCenter}>{index + 1}</td>
                <td className={styles.textCenter}>{material.mcode}</td>
                <td className={styles.textLeft}>{material.name}</td>
                <td className={styles.textCenter}>{material.ordered}</td>
                <td className={styles.textCenter}>{material.stock}</td>
                <td className={styles.textCenter}>{material.gst ?? 0}</td>
                <td className={styles.textRight}>
                  {Number(material.rate ?? 0).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className={styles.textCenter}>
                  {getMaterialLocationName(material.location, purchase.location, locationName)}
                </td>
                <td className={`${styles.textCenter} ${styles.noPrint}`}>
                  <button className={styles.iconBtnEdit} onClick={() => openEditModal(material)} title="Edit RawMaterial">
                    <FaPencilAlt />
                  </button>
                  <button
                    className={styles.iconBtnDelete}
                    onClick={() => material._id && removeMaterial(material._id)}
                    title="Remove RawMaterial"
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={9} className={styles.emptyTableText}>
                  No RawMaterials added to this purchase order yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className={styles.summaryGrid}>
          <div className={styles.summaryLeft}>
            <div className={styles.wordsRow}>
              <span className={styles.wordsLabel}>Raw materials ordered:</span>
              <p className={styles.wordsValue}>{materials.length}</p>
            </div>
            <div className={styles.bankBlock}>
              <h4 className={styles.bankTitle}>Your Bank Details :</h4>
              <table className={styles.bankDetailsTable}>
                <tbody>
                  <tr><td>Bank Name :</td><td><strong>State Bank Of India</strong></td></tr>
                  <tr><td>Branch :</td><td><strong>PAIKPARA</strong></td></tr>
                  <tr><td>Account No :</td><td><strong>38088881020</strong></td></tr>
                  <tr><td>IFSC :</td><td><strong>S B I N 0001747</strong></td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className={styles.summaryRight}>
            <table className={styles.breakdownTable}>
              <tbody>
                <tr><td>Purchase Order</td><td className={styles.amountCol}>{purchase.PONumber || '-'}</td></tr>
                <tr><td>Supplier</td><td className={styles.amountCol}>{purchase.supplier || '-'}</td></tr>
                <tr><td>Location</td><td className={styles.amountCol}>{locationName}</td></tr>
                <tr><td>Delivery Date</td><td className={styles.amountCol}>{deliveryDateText}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.footerGrid}>
          <div className={styles.termsBlock}>
            <h4 className={styles.termsTitle}>Terms &amp; Condition:</h4>
            <ol className={styles.termsList}>
              <li>Supplied quantity should not be less than PO quantity.</li>
              <li><u>Delivery: IGC, Matia, Mornoi, Goalpara-783101</u></li>
              <li>Delivery should be strictly within 30 days, i.e. by {deliveryDateText}.</li>
              <li>On delivery to transporter, please share the CN Copy.</li>
            </ol>
          </div>
          <div className={styles.signatoryBlock}>
            <p className={styles.companySignTitle}>For H-BUS Equipment Manufacturing Company</p>
            <div className={styles.signatureSpace}></div>
            <p className={styles.signatoryLabel}>Authorised Signatory</p>
          </div>
        </div>
        <div className={styles.bottomBanner}>
          <p>Regd Office: House No: 4, Dhrubajyoti Path, Ambikagiri Nagar, R.G.B. Road, Guwahati, Assam</p>
          <p>Mob: 9854089190 / 9101036494; &nbsp;&nbsp; Email: hbustransformers@gmail.com &nbsp;&nbsp; Web: www.hbus.org</p>
        </div>
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>{editingId ? 'Edit Raw Material' : 'Add Raw Material'}</h3>
              <button className={styles.closeBtn} onClick={() => setModalOpen(false)} aria-label="Close">
                <FaTimes />
              </button>
            </div>
            {!editingId && searchStatus === 'idle' && (
              <div className={styles.modalBody}>
                <div className={styles.searchSection} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                  <div className={styles.formGroup} style={{ flex: 1 }}>
                    <label>Search by Material Code</label>
                    <input value={searchMcode} onChange={(event) => setSearchMcode(event.target.value)} />
                  </div>
                  <button
                    type="button"
                    onClick={() => void searchMaterial()}
                    className={styles.primaryBtn}
                    style={{ marginTop: 24 }}
                  >
                    <FaSearch /> Search
                  </button>
                </div>
              </div>
            )}
            {searchStatus === 'loading' && <p>Searching RawMaterials...</p>}
            {(editingId || searchStatus === 'found' || searchStatus === 'not-found') && (
              <form onSubmit={saveMaterial} className={styles.modalForm}>
                <div className={styles.formGroup}>
                  <label>Material Code *</label>
                  <input required value={form.mcode} onChange={(event) => setForm({ ...form, mcode: event.target.value })} />
                </div>
                <div className={styles.formGroup}>
                  <label>Material Name *</label>
                  <input required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Ordered *</label>
                    <input type="number" min="0" required value={form.ordered} onChange={(event) => setForm({ ...form, ordered: event.target.value })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Stock *</label>
                    <input type="number" min="0" required value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>GST (%)</label>
                    <input type="number" min="0" step="0.01" value={form.gst} onChange={(event) => setForm({ ...form, gst: event.target.value })} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Rate (₹)</label>
                    <input type="number" min="0" step="0.01" value={form.rate} onChange={(event) => setForm({ ...form, rate: event.target.value })} />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>Location</label>
                  <input readOnly value={locationName} />
                </div>
                <div className={styles.modalActions}>
                  {!editingId && searchStatus === 'not-found' && (
                    <button type="button" className={styles.secondaryBtn} onClick={() => {
                      setSearchStatus('idle');
                      setFoundMaterialId(null);
                    }}>
                      Back
                    </button>
                  )}
                  <button type="button" className={styles.secondaryBtn} onClick={() => setModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.primaryBtn}>
                    {editingId ? 'Update Raw Material' : searchStatus === 'found' ? 'Add Found Material' : 'Create & Add'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
