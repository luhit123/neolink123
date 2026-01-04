import React, { useState, useEffect } from 'react';
import { AdmissionIndication, Unit } from '../types';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { PlusIcon, TrashIcon, XIcon } from './common/Icons';

interface AdmissionIndicationsManagerProps {
  userEmail: string;
}

const AdmissionIndicationsManager: React.FC<AdmissionIndicationsManagerProps> = ({ userEmail }) => {
  const [indications, setIndications] = useState<AdmissionIndication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIndication, setEditingIndication] = useState<AdmissionIndication | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    applicableUnits: [] as Unit[],
    isActive: true,
    order: 0
  });

  useEffect(() => {
    fetchIndications();
  }, []);

  const fetchIndications = async () => {
    setLoading(true);
    try {
      const indicationsRef = collection(db, 'admissionIndications');
      const q = query(indicationsRef, orderBy('order', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdmissionIndication));
      setIndications(data);
    } catch (error) {
      console.error('Error fetching indications:', error);
      alert('Failed to load admission indications');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Please enter an indication name');
      return;
    }

    if (formData.applicableUnits.length === 0) {
      alert('Please select at least one applicable unit');
      return;
    }

    try {
      if (editingIndication) {
        // Update existing indication
        const indicationRef = doc(db, 'admissionIndications', editingIndication.id);
        await updateDoc(indicationRef, {
          name: formData.name.trim(),
          applicableUnits: formData.applicableUnits,
          isActive: formData.isActive,
          order: formData.order,
          lastModifiedAt: new Date().toISOString(),
          lastModifiedBy: userEmail
        });
        alert('Indication updated successfully!');
      } else {
        // Add new indication
        await addDoc(collection(db, 'admissionIndications'), {
          name: formData.name.trim(),
          applicableUnits: formData.applicableUnits,
          isActive: formData.isActive,
          order: formData.order || indications.length,
          createdAt: new Date().toISOString(),
          createdBy: userEmail
        });
        alert('Indication added successfully!');
      }

      resetForm();
      fetchIndications();
    } catch (error) {
      console.error('Error saving indication:', error);
      alert('Failed to save indication');
    }
  };

  const handleEdit = (indication: AdmissionIndication) => {
    setEditingIndication(indication);
    setFormData({
      name: indication.name,
      applicableUnits: indication.applicableUnits,
      isActive: indication.isActive,
      order: indication.order
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'admissionIndications', id));
      alert('Indication deleted successfully!');
      fetchIndications();
    } catch (error) {
      console.error('Error deleting indication:', error);
      alert('Failed to delete indication');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      applicableUnits: [],
      isActive: true,
      order: 0
    });
    setEditingIndication(null);
    setShowAddForm(false);
  };

  const toggleUnit = (unit: Unit) => {
    setFormData(prev => ({
      ...prev,
      applicableUnits: prev.applicableUnits.includes(unit)
        ? prev.applicableUnits.filter(u => u !== unit)
        : [...prev.applicableUnits, unit]
    }));
  };

  const initializeDefaultIndications = async () => {
    if (!confirm('This will add all default NICU/SNCU indications. Continue?')) {
      return;
    }

    const defaultIndications = [
      'Prematurity (< 34 weeks)',
      'Low Birth Weight (< 1800 gm)',
      'Perinatal Asphyxia',
      'Neonatal Jaundice',
      'Resp. Distress (Rate > 60 or Grunt / Retractions)',
      'Large Baby (> 4 Kg. at 40 weeks)',
      'Refusal to Feed',
      'Central Cyanosis',
      'Apnea / Gasping',
      'Neonatal Convulsions',
      'Baby of Diabetic mother',
      'Oliguria',
      'Abdominal Distension',
      'Hypothermia (< 35.4 °C)',
      'Hyperthermia (> 37.5 °C)',
      'Hypoglycemia (< 45 mg%)',
      'Shock (Cold Periphery with CFT > 3 sec & Weak Fast Pulse)',
      'Meconium Aspiration',
      'Bleeding',
      'Diarrhoea',
      'Vomiting',
      'Major Congenital Malformation',
      'Unconsciousness',
      'Any Other'
    ];

    try {
      const batch = defaultIndications.map((name, index) =>
        addDoc(collection(db, 'admissionIndications'), {
          name,
          applicableUnits: [Unit.NICU, Unit.SNCU],
          isActive: true,
          order: index,
          createdAt: new Date().toISOString(),
          createdBy: userEmail
        })
      );

      await Promise.all(batch);
      alert(`Successfully added ${defaultIndications.length} default indications!`);
      fetchIndications();
    } catch (error) {
      console.error('Error initializing indications:', error);
      alert('Failed to initialize default indications');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="text-slate-400 mt-4">Loading admission indications...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Admission Indications Management</h2>
          <p className="text-slate-400 text-sm mt-1">
            Manage admission indications for NICU, SNCU, PICU, and other units
          </p>
        </div>
        <div className="flex gap-3">
          {indications.length === 0 && (
            <button
              onClick={initializeDefaultIndications}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 animate-pulse"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Initialize Defaults
            </button>
          )}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
          >
            {showAddForm ? <XIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
            {showAddForm ? 'Cancel' : 'Add New Indication'}
          </button>
        </div>
      </div>

      {/* Quick Start Guide - Show when no indications */}
      {indications.length === 0 && !showAddForm && (
        <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-2 border-green-500/50 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-green-200 mb-2">🚀 Quick Start: Initialize Admission Indications</h3>
              <p className="text-slate-300 mb-4">
                To enable the admission indications feature for NICU/SNCU patients, you need to initialize the default indications first.
              </p>
              <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-slate-200 mb-2">What happens when you click "Initialize Defaults"?</p>
                <ul className="text-sm text-slate-300 space-y-1 ml-4">
                  <li>✓ Adds 24 standard NICU/SNCU admission indications</li>
                  <li>✓ Includes: Prematurity, Low Birth Weight, Perinatal Asphyxia, Respiratory Distress, etc.</li>
                  <li>✓ All indications are immediately available to all doctors across all institutions</li>
                  <li>✓ You can edit, reorder, or add more indications anytime</li>
                </ul>
              </div>
              <button
                onClick={initializeDefaultIndications}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors flex items-center gap-2 text-lg shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Initialize 24 Default Indications Now
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
          <h3 className="text-lg font-semibold text-white mb-4">
            {editingIndication ? 'Edit Indication' : 'Add New Indication'}
          </h3>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
              Indication Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Prematurity (< 34 weeks)"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Applicable Units <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.values(Unit).map(unit => (
                <label
                  key={unit}
                  className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${
                    formData.applicableUnits.includes(unit)
                      ? 'bg-blue-600/30 border-2 border-blue-400'
                      : 'bg-slate-700 border-2 border-slate-600 hover:border-blue-400/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.applicableUnits.includes(unit)}
                    onChange={() => toggleUnit(unit)}
                    className="w-4 h-4 text-blue-600 bg-slate-600 border-slate-500 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-200">{unit}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="order" className="block text-sm font-medium text-slate-300 mb-2">
                Display Order
              </label>
              <input
                type="number"
                id="order"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
              <label className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-green-600 bg-slate-600 border-slate-500 rounded focus:ring-green-500"
                />
                <span className="text-sm text-slate-200">Active</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {editingIndication ? 'Update' : 'Add'} Indication
            </button>
          </div>
        </form>
      )}

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Indication Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Applicable Units
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {indications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="text-slate-400">
                      <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm">No admission indications configured yet.</p>
                      <p className="text-xs mt-2">Click "Initialize Defaults" to add standard NICU/SNCU indications,</p>
                      <p className="text-xs">or "Add New Indication" to create a custom one.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                indications.map((indication) => (
                  <tr key={indication.id} className="hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-300">{indication.order}</td>
                    <td className="px-4 py-3 text-sm text-white font-medium">{indication.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {indication.applicableUnits.map(unit => (
                          <span key={unit} className="px-2 py-1 bg-blue-600/30 text-blue-200 text-xs rounded-full">
                            {unit}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        indication.isActive
                          ? 'bg-green-600/30 text-green-200'
                          : 'bg-red-600/30 text-red-200'
                      }`}>
                        {indication.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(indication)}
                          className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(indication.id, indication.name)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdmissionIndicationsManager;
