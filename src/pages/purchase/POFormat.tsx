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

// Helper: Convert number to Indian Currency Words (Rupees & Paise)
const numberToIndianWords = (num: number): string => {
  if (isNaN(num) || num < 0) return '';
  const [rupeesStr, paiseStr] = num.toFixed(2).split('.');
  let rupees = parseInt(rupeesStr, 10);
  const paise = parseInt(paiseStr, 10);

  if (rupees === 0 && paise === 0) return 'Rupees Zero Only';

  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  const convertTwoDigits = (n: number): string => {
    if (n < 20) return ones[n];
    return `${tens[Math.floor(n / 10)]} ${ones[n % 10]}`.trim();
  };

  const convertThreeDigits = (n: number): string => {
    let str = '';
    if (Math.floor(n / 100) > 0) {
      str += `${ones[Math.floor(n / 100)]} Hundred `;
    }
    if (n % 100 > 0) {
      str += convertTwoDigits(n % 100);
    }
    return str.trim();
  };

  let words = '';

  if (rupees >= 10000000) {
    words += `${convertTwoDigits(Math.floor(rupees / 10000000))} Crores `;
    rupees %= 10000000;
  }
  if (rupees >= 100000) {
    words += `${convertTwoDigits(Math.floor(rupees / 100000))} Lakhs `;
    rupees %= 100000;
  }
  if (rupees >= 1000) {
    words += `${convertTwoDigits(Math.floor(rupees / 1000))} Thousand `;
    rupees %= 1000;
  }
  if (rupees > 0) {
    words += convertThreeDigits(rupees);
  }

  words = words.trim() ? `Rupees ${words.trim()}` : 'Rupees Zero';

  if (paise > 0) {
    words += ` and Paise ${convertTwoDigits(paise)} Only`;
  } else {
    words += ' and Paise Zero Only';
  }

  return words;
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
        // Update item document directly via item endpoint
        await axios.put(`${import.meta.env.VITE_APP_API}/api/items/${editingItemId}`, itemForm);
        toast.success('Item updated successfully.');
      } else {
        // Create a new item document in the Item collection
        const itemRes = await axios.post(`${import.meta.env.VITE_APP_API}/api/items`, itemForm);
        const newItemId = itemRes.data._id;

        // Extract existing ObjectIds and push the newly created ObjectId to Purchase
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

  // Dynamic Calculations based on items array
  const itemsList: Item[] = poData?.items || [];
  const totalWithoutTax = itemsList.reduce(
    (sum, item) => sum + (item.rate || 0) * (item.qty || 0),
    0,
  );

  // Check GST state (Assam Code: 18 / Assam state) to split CGST/SGST vs IGST
  const isIntraState =
    poData?.supplierStateCode === '18' ||
    (poData?.supplierState || '').toLowerCase().includes('assam');

  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;

  itemsList.forEach((item) => {
    const itemTotal = (item.rate || 0) * (item.qty || 0);
    const taxAmount = itemTotal * ((item.gst || 0) / 100);
    if (isIntraState) {
      totalCGST += taxAmount / 2;
      totalSGST += taxAmount / 2;
    } else {
      totalIGST += taxAmount;
    }
  });

  const totalTax = totalCGST + totalSGST + totalIGST;
  const grandTotal = totalWithoutTax + totalTax;
  const roundOffTotal = Math.round(grandTotal);

  // Delivery target date (30 days after PO Date)
  const poDateObj = poData?.invoicedate || poData?.date ? new Date(poData.invoicedate || poData.date) : new Date();
  const deliveryDateObj = new Date(poDateObj);
  deliveryDateObj.setDate(deliveryDateObj.getDate() + 30);
  const formattedDeliveryDate = deliveryDateObj.toLocaleDateString('en-GB');

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
            {itemsList.length > 0 ? (
              itemsList.map((item: Item, index: number) => {
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
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className={styles.textCenter}>{item.qty}</td>
                    <td className={styles.textRight}>
                      {totalAmount.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
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

        {/* Calculation Summary & Bank Details Block */}
        <div className={styles.summaryGrid}>
          {/* Left Column: Words & Bank Details */}
          <div className={styles.summaryLeft}>
            <div className={styles.wordsRow}>
              <span className={styles.wordsLabel}>₹ (in words):</span>
              <p className={styles.wordsValue}>{numberToIndianWords(roundOffTotal)}</p>
            </div>

            <div className={styles.bankBlock}>
              <h4 className={styles.bankTitle}>Your Bank Details :</h4>
              <table className={styles.bankDetailsTable}>
                <tbody>
                  <tr>
                    <td>Bank Name :</td>
                    <td><strong>State Bank Of India</strong></td>
                  </tr>
                  <tr>
                    <td>Branch :</td>
                    <td><strong>PAIKPARA</strong></td>
                  </tr>
                  <tr>
                    <td>Account No :</td>
                    <td><strong>38088881020</strong></td>
                  </tr>
                  <tr>
                    <td>IFSC :</td>
                    <td><strong>S B I N 0001747</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Amount Breakdowns */}
          <div className={styles.summaryRight}>
            <table className={styles.breakdownTable}>
              <tbody>
                <tr>
                  <td>Total Without Tax</td>
                  <td className={styles.amountCol}>
                    {totalWithoutTax.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
                <tr>
                  <td>Discount Amount</td>
                  <td className={styles.amountCol}>-</td>
                </tr>
                <tr>
                  <td>CGST</td>
                  <td className={styles.amountCol}>
                    {totalCGST > 0
                      ? totalCGST.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : ''}
                  </td>
                </tr>
                <tr>
                  <td>SGST</td>
                  <td className={styles.amountCol}>
                    {totalSGST > 0
                      ? totalSGST.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : ''}
                  </td>
                </tr>
                <tr>
                  <td>IGST</td>
                  <td className={styles.amountCol}>
                    {totalIGST > 0
                      ? totalIGST.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : ''}
                  </td>
                </tr>
                <tr className={styles.boldRow}>
                  <td>Total Amount</td>
                  <td className={styles.amountCol}>
                    {grandTotal.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
                <tr>
                  <td>Advance</td>
                  <td className={styles.amountCol}>-</td>
                </tr>
                <tr className={styles.boldRow}>
                  <td>Payable Amount</td>
                  <td className={styles.amountCol}>
                    {grandTotal.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
                <tr className={styles.highlightRow}>
                  <td>Round Off</td>
                  <td className={styles.amountCol}>
                    {roundOffTotal.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Terms & Authorised Signatory Footer Row */}
        <div className={styles.footerGrid}>
          <div className={styles.termsBlock}>
            <h4 className={styles.termsTitle}>Terms & Condition:</h4>
            <ol className={styles.termsList}>
              <li>Supplied Quantity Should Not Be Less Than PO Quantity</li>
              <li>
                <u>Delivery: IGC, Matia, Mornoi, Goalpara-783101</u>
              </li>
              <li>
                Delivery should be strictly within 30 days from today, i.e . by{' '}
                {formattedDeliveryDate}
              </li>
              <li>On delivery to transporter, please share the CN Copy</li>
            </ol>
          </div>

          <div className={styles.signatoryBlock}>
            <p className={styles.companySignTitle}>
              For H-BUS Equipment Manufacturing Company
            </p>
            <div className={styles.signatureSpace}>
              {/* Optional Signature image or space */}
            </div>
            <p className={styles.signatoryLabel}>Authorised Signatory</p>
          </div>
        </div>

        {/* Bottom Banner Address Line */}
        <div className={styles.bottomBanner}>
          <p>
            Regd Office: House No: 4, Dhrubajyoti Path, Ambikagiri Nagar, R.G.B. Road, Guwahati, Assam
          </p>
          <p>
            Mob: 9854089190 / 9101036494; &nbsp;&nbsp; Email: hbustransformers@gmail.com &nbsp;&nbsp; Web: www.hbus.org
          </p>
        </div>
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