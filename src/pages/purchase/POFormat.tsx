import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { FaPlus, FaPencilAlt, FaTrash, FaPrint, FaArrowLeft, FaTimes } from 'react-icons/fa';
import styles from './POFormat.module.scss';

type Item = {
  _id?: string;
  description: string;
  gst: number;
  unit: string;
  rate: number;
  qty: number;
};

const initialItemState: Item = {
  description: '',
  gst: 18,
  unit: 'NOS',
  rate: 0,
  qty: 1,
};

// Helper component to render individual character grid boxes
const BoxedText: React.FC<{ text?: string; minLength?: number }> = ({ text = '', minLength = 0 }) => {
  const chars = text.split('');
  while (chars.length < minLength) {
    chars.push('');
  }

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

export default function POFormat() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [poData, setPoData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal & Form state for Adding/Editing Items
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<Item>(initialItemState);

  const fetchPOData = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_APP_API}/api/purchases/${id}`);
      setPoData(response.data);
    } catch (error) {
      console.error('Error fetching PO data:', error);
      toast.error('Failed to load purchase order details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchPOData();
  }, [id]);

  const handleOpenAddModal = () => {
    setEditingItemId(null);
    setItemForm(initialItemState);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: Item) => {
    setEditingItemId(item._id || null);
    setItemForm({
      description: item.description,
      gst: item.gst,
      unit: item.unit,
      rate: item.rate,
      qty: item.qty,
    });
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItemId) {
        // 1. Update item document directly via item endpoint
        await axios.put(`${import.meta.env.VITE_APP_API}/api/items/${editingItemId}`, itemForm);
        toast.success('Item updated successfully.');
      } else {
        // 1. Create a new item document in the Item collection
        const itemRes = await axios.post(`${import.meta.env.VITE_APP_API}/api/items`, itemForm);
        const newItemId = itemRes.data._id;

        // 2. Extract existing ObjectIds and push the newly created ObjectId to Purchase
        const currentItemIds = (poData?.items || []).map((it: any) =>
          typeof it === 'string' ? it : it._id,
        );
        const updatedItemIds = [...currentItemIds, newItemId];

        await axios.put(`${import.meta.env.VITE_APP_API}/api/purchases/${id}`, {
          items: updatedItemIds,
        });
        toast.success('Item added successfully.');
      }

      await fetchPOData();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Error saving item:', error);
      toast.error(error.response?.data?.message || 'Failed to save item.');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      // 1. Unlink item ID from Purchase document
      const updatedItemIds = (poData?.items || [])
        .map((it: any) => (typeof it === 'string' ? it : it._id))
        .filter((itId: string) => itId !== itemId);

      await axios.put(`${import.meta.env.VITE_APP_API}/api/purchases/${id}`, {
        items: updatedItemIds,
      });

      // 2. Remove item document from database
      await axios.delete(`${import.meta.env.VITE_APP_API}/api/items/${itemId}`);

      toast.success('Item deleted successfully.');
      await fetchPOData();
    } catch (error: any) {
      console.error('Error deleting item:', error);
      toast.error(error.response?.data?.message || 'Failed to delete item.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className={styles.loadingContainer}>Loading Purchase Order...</div>;
  }

  // Format Date for Boxed view (DD/MM/YYYY)
  const formattedDate =
    poData?.invoicedate || poData?.date
      ? new Date(poData.invoicedate || poData.date).toLocaleDateString('en-GB')
      : '';

  return (
    <div className={styles.pageWrapper}>
      {/* Action Controls Bar (Hidden during Print) */}
      <div className={`${styles.actionBar} ${styles.noPrint}`}>
        <button className={styles.secondaryBtn} onClick={() => navigate('/purchase')}>
          <FaArrowLeft /> Back to Purchases
        </button>
        <div className={styles.rightActions}>
          <button className={styles.primaryBtn} onClick={handleOpenAddModal}>
            <FaPlus /> Add Item
          </button>
          <button className={styles.printBtn} onClick={handlePrint}>
            <FaPrint /> Print PO
          </button>
        </div>
      </div>

      {/* Main PO Document Sheet */}
      <div className={styles.poDocument}>
        {/* Header Title */}
        <h1 className={styles.mainTitle}>PURCHASE ORDER</h1>

        {/* Company Header Row */}
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

        {/* GSTN Line */}
        <div className={styles.metaRow}>
          <div className={styles.metaGroup}>
            <span className={styles.metaLabel}>GSTN :</span>
            <BoxedText text={poData?.location?.gstn || poData?.gstn || ''} minLength={15} />
          </div>
        </div>

        {/* Purchase Order No & Date Line */}
        <div className={styles.metaRow}>
          <div className={styles.metaGroup}>
            <span className={styles.metaLabel}>Purchase Order No</span>
            <BoxedText text={poData?.PONumber || ''} minLength={16} />
          </div>
          <div className={styles.metaGroup}>
            <span className={styles.metaLabel}>DATE :</span>
            <BoxedText text={formattedDate} minLength={10} />
          </div>
        </div>

        {/* Supplier and Shipping Address Split Block */}
        <div className={styles.addressGrid}>
          <div className={styles.supplierBlock}>
            <p className={styles.blockLabel}>To</p>
            <p className={styles.supplierName}>{poData?.supplier || '-'}</p>
            <p className={styles.supplierAddress}>{poData?.supplierAddress || '-'}</p>
            <div className={styles.gstnInline}>
              <span className={styles.metaLabel}>GSTIN:</span>
              <BoxedText text={poData?.gstn || ''} minLength={15} />
            </div>
            <div className={styles.stateRow}>
              <span>State : {poData?.supplierState || '-'}</span>
              <span>State Code : {poData?.supplierStateCode || '-'}</span>
            </div>
          </div>

          <div className={styles.shippingBlock}>
            <p className={styles.blockLabelUnderline}>Shipping Address</p>
            <p className={styles.shippingAddress}>
              {poData?.location?.address ||
                poData?.location?.name ||
                'IGC, MORNOI\nGOALPARA, ASSAM\nPIN CODE-783101'}
            </p>
          </div>
        </div>

        {/* Items Table */}
        <table className={styles.itemsTable}>
          <thead>
            <tr>
              <th style={{ width: '6%' }}>Sl No</th>
              <th style={{ width: '44%' }}>Item Description</th>
              <th style={{ width: '8%' }}>GST</th>
              <th style={{ width: '8%' }}>Unit</th>
              <th style={{ width: '12%' }}>Rate</th>
              <th style={{ width: '7%' }}>Qty</th>
              <th style={{ width: '15%' }}>Total Amount</th>
              <th className={styles.noPrint} style={{ width: '8%' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {poData?.items && poData.items.length > 0 ? (
              poData.items.map((item: Item, index: number) => {
                const totalAmount = (item.rate || 0) * (item.qty || 0);
                return (
                  <tr key={item._id || index}>
                    <td className={styles.textCenter}>{index + 1}</td>
                    <td className={styles.textLeft}>{item.description}</td>
                    <td className={styles.textCenter}>{item.gst}%</td>
                    <td className={styles.textCenter}>{item.unit}</td>
                    <td className={styles.textRight}>
                      {Number(item.rate).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className={styles.textCenter}>{item.qty}</td>
                    <td className={styles.textRight}>
                      {totalAmount.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className={`${styles.textCenter} ${styles.noPrint}`}>
                      <button
                        className={styles.iconBtnEdit}
                        onClick={() => handleOpenEditModal(item)}
                        title="Edit Item"
                      >
                        <FaPencilAlt />
                      </button>
                      <button
                        className={styles.iconBtnDelete}
                        onClick={() => item._id && handleDeleteItem(item._id)}
                        title="Delete Item"
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className={styles.emptyTableText}>
                  No items added to this Purchase Order yet. Click "Add Item" above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Item Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>{editingItemId ? 'Edit Item' : 'Add New Item'}</h3>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleSaveItem} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label>Item Description *</label>
                <textarea
                  rows={3}
                  required
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  placeholder="Enter detailed item description..."
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>GST (%) *</label>
                  <input
                    type="number"
                    required
                    value={itemForm.gst}
                    onChange={(e) => setItemForm({ ...itemForm, gst: Number(e.target.value) })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Unit *</label>
                  <input
                    type="text"
                    required
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    placeholder="e.g. NOS, KG, SET"
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Rate (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={itemForm.rate}
                    onChange={(e) => setItemForm({ ...itemForm, rate: Number(e.target.value) })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Quantity *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={itemForm.qty}
                    onChange={(e) => setItemForm({ ...itemForm, qty: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn}>
                  {editingItemId ? 'Update Item' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}