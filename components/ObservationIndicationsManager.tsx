import React, { useState, useEffect } from 'react';
import { ObservationIndication, Unit } from '../types';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { PlusIcon, TrashIcon, XIcon } from './common/Icons';

interface ObservationIndicationsManagerProps {
  userEmail: string;
}

const ObservationIndicationsManager: React.FC<ObservationIndicationsManagerProps> = ({ userEmail }) => {
  const [indications, setIndications] = useState<ObservationIndication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIndication, setEditingIndication] = useState<ObservationIndication | null>(null);

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
      const indicationsRef = collection(db, 'observationIndications');
      const q = query(indicationsRef, orderBy('order', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ObservationIndication));
      setIndications(data);
    } catch (error) {
      console.error('Error fetching observation indications:', error);
      alert('Failed to load observation indications');
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
        const indicationRef = doc(db, 'observationIndications', editingIndication.id);
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
        await addDoc(collection(db, 'observationIndications'), {
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

  const handleEdit = (indication: ObservationIndication) => {
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
      await deleteDoc(doc(db, 'observationIndications', id));
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
    if (!confirm('This will add default observation indications for NICU, SNCU, and other units. Continue?')) {
      return;
    }

    // Default observation indications for neonatal observation
    const defaultIndications = [
      { name: 'Large Caput', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Urine Not Passed', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Stool Not Passed', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Poor Feeding', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Hypothermia', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Vomiting', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Grunting', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Respiratory Distress', units: [Unit.NICU, Unit.SNCU, Unit.PICU] },
      { name: 'Meconium Stained Liquor', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Low Birth Weight (LBW)', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Mother Not Well', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Cyanosis', units: [Unit.NICU, Unit.SNCU, Unit.PICU] },
      { name: 'Jaundice', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Lethargy', units: [Unit.NICU, Unit.SNCU, Unit.PICU] },
      { name: 'Seizures / Convulsions', units: [Unit.NICU, Unit.SNCU, Unit.PICU] },
      { name: 'Birth Asphyxia (Observation)', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Prematurity Observation', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Suspected Sepsis', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Hypoglycemia Risk', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Baby of Diabetic Mother', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Feeding Difficulty', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Abdominal Distension', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Umbilical Discharge', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Fever', units: [Unit.NICU, Unit.SNCU, Unit.PICU, Unit.HDU] },
      { name: 'Cold Extremities', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Refusal to Feed', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Excessive Crying', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Skin Rash / Pustules', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Bleeding from Any Site', units: [Unit.NICU, Unit.SNCU, Unit.PICU] },
      { name: 'Other (Specify in remarks)', units: [Unit.NICU, Unit.SNCU, Unit.PICU, Unit.HDU, Unit.GENERAL_WARD] }
    ];

    try {
      const batch = defaultIndications.map((indication, index) =>
        addDoc(collection(db, 'observationIndications'), {
          name: indication.name,
          applicableUnits: indication.units,
          isActive: true,
          order: index,
          createdAt: new Date().toISOString(),
          createdBy: userEmail
        })
      );

      await Promise.all(batch);
      alert(`Successfully added ${defaultIndications.length} observation indications!`);
      fetchIndications();
    } catch (error) {
      console.error('Error initializing indications:', error);
      alert('Failed to initialize default indications');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
        <p className="text-slate-400 mt-4">Loading observation indications...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Observation Indications Management</h2>
          <p className="text-slate-400 text-sm mt-1">
            Reasons for keeping babies under observation before admission decision
          </p>
        </div>
        <div className="flex gap-3">
          {indications.length === 0 && (
            <button
              onClick={initializeDefaultIndications}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 animate-pulse"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Initialize Defaults
            </button>
          )}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
          >
            {showAddForm ? <XIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
            {showAddForm ? 'Cancel' : 'Add New Indication'}
          </button>
        </div>
      </div>

      {/* Quick Start Guide - Show when no indications */}
      {indications.length === 0 && !showAddForm && (
        <div className="bg-gradient-to-r from-amber-900/30 to-orange-900/30 border-2 border-amber-500/50 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-amber-200 mb-2">Initialize Observation Indications</h3>
              <p className="text-slate-300 mb-4">
                Add common reasons for observation including: Large Caput, Urine/Stool not passed, Poor feeding, Hypothermia, Vomiting, Grunting, Respiratory distress, Meconium stained liquor, LBW, Mother not well, and more.
              </p>
              <button
                onClick={initializeDefaultIndications}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition-colors flex items-center gap-2 text-lg shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Initialize 30 Observation Indications
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
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="e.g., Large Caput"
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
                      ? 'bg-amber-600/30 border-2 border-amber-400'
                      : 'bg-slate-700 border-2 border-slate-600 hover:border-amber-400/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.applicableUnits.includes(unit)}
                    onChange={() => toggleUnit(unit)}
                    className="w-4 h-4 text-amber-600 bg-slate-600 border-slate-500 rounded focus:ring-amber-500"
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
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
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
              className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition-colors"
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <p className="text-sm">No observation indications configured yet.</p>
                      <p className="text-xs mt-2">Click "Initialize Defaults" to add standard indications,</p>
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
                          <span key={unit} className="px-2 py-1 bg-amber-600/30 text-amber-200 text-xs rounded-full">
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
                          className="p-2 text-amber-400 hover:text-amber-300 hover:bg-amber-900/30 rounded-lg transition-colors"
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

export default ObservationIndicationsManager;
