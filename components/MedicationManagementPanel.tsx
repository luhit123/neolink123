import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { MedicationDatabase, MedicationCategory, Unit } from '../types';
import LoadingOverlay from './LoadingOverlay';
import { seedMedications, getMedicationCount } from '../utils/medicationSeeder';

interface MedicationManagementPanelProps {
  userEmail: string;
  onClose: () => void;
}

const MedicationManagementPanel: React.FC<MedicationManagementPanelProps> = ({ userEmail, onClose }) => {
  const [medications, setMedications] = useState<MedicationDatabase[]>([]);
  const [filteredMedications, setFilteredMedications] = useState<MedicationDatabase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<MedicationCategory | 'All'>('All');
  const [showForm, setShowForm] = useState(false);
  const [editingMed, setEditingMed] = useState<MedicationDatabase | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<MedicationDatabase>>({
    name: '',
    brandNames: [],
    category: MedicationCategory.Antibiotic,
    commonDoses: [],
    routes: [],
    frequencies: [],
    indication: '',
    applicableUnits: [],
    ageGroups: [],
    warnings: '',
    searchTerms: [],
    isActive: true,
  });

  // Temporary input states for array fields
  const [brandNameInput, setBrandNameInput] = useState('');
  const [doseInput, setDoseInput] = useState('');
  const [routeInput, setRouteInput] = useState('');
  const [frequencyInput, setFrequencyInput] = useState('');
  const [ageGroupInput, setAgeGroupInput] = useState('');
  const [searchTermInput, setSearchTermInput] = useState('');

  useEffect(() => {
    fetchMedications();
  }, []);

  useEffect(() => {
    // Filter medications based on search and category
    let filtered = medications;

    if (searchTerm) {
      filtered = filtered.filter(med =>
        med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        med.indication?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        med.brandNames?.some(brand => brand.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (categoryFilter !== 'All') {
      filtered = filtered.filter(med => med.category === categoryFilter);
    }

    setFilteredMedications(filtered);
  }, [searchTerm, categoryFilter, medications]);

  const fetchMedications = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'medications'), orderBy('name'));
      const snapshot = await getDocs(q);
      const meds = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as MedicationDatabase[];
      setMedications(meds);
      setFilteredMedications(meds);
    } catch (error) {
      console.error('Error fetching medications:', error);
      alert('Failed to load medications');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.category || !formData.indication) {
      alert('Please fill in all required fields (Name, Category, Indication)');
      return;
    }

    setSaving(true);
    setSaveMessage(editingMed ? 'Updating medication...' : 'Adding medication...');

    try {
      if (editingMed) {
        // Update existing medication
        await updateDoc(doc(db, 'medications', editingMed.id), {
          ...formData,
          lastModifiedAt: new Date().toISOString(),
          lastModifiedBy: userEmail,
        });
        setSaveMessage('✓ Medication updated successfully!');
      } else {
        // Add new medication
        await addDoc(collection(db, 'medications'), {
          ...formData,
          createdAt: new Date().toISOString(),
          createdBy: userEmail,
          isActive: true,
        });
        setSaveMessage('✓ Medication added successfully!');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      await fetchMedications();
      resetForm();
      setShowForm(false);
    } catch (error) {
      console.error('Error saving medication:', error);
      alert('Failed to save medication');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(''), 2000);
    }
  };

  const handleEdit = (med: MedicationDatabase) => {
    setEditingMed(med);
    setFormData(med);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this medication? This cannot be undone.')) {
      return;
    }

    setSaving(true);
    setSaveMessage('Deleting medication...');

    try {
      await deleteDoc(doc(db, 'medications', id));
      setSaveMessage('✓ Medication deleted successfully!');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await fetchMedications();
    } catch (error) {
      console.error('Error deleting medication:', error);
      alert('Failed to delete medication');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(''), 2000);
    }
  };

  const handleSeedDatabase = async () => {
    const medCount = getMedicationCount();
    if (!confirm(`This will add ${medCount} common NICU/PICU medications to your database. Existing medications will not be affected. Continue?`)) {
      return;
    }

    setSaving(true);
    setSaveMessage('Seeding medication database...');

    try {
      const result = await seedMedications(userEmail);
      setSaveMessage(`✓ Successfully added ${result.success} medications! ${result.failed > 0 ? `(${result.failed} failed)` : ''}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      await fetchMedications();
    } catch (error) {
      console.error('Error seeding database:', error);
      alert('Failed to seed medication database');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(''), 2000);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      brandNames: [],
      category: MedicationCategory.Antibiotic,
      commonDoses: [],
      routes: [],
      frequencies: [],
      indication: '',
      applicableUnits: [],
      ageGroups: [],
      warnings: '',
      searchTerms: [],
      isActive: true,
    });
    setEditingMed(null);
    setBrandNameInput('');
    setDoseInput('');
    setRouteInput('');
    setFrequencyInput('');
    setAgeGroupInput('');
    setSearchTermInput('');
  };

  // Helper functions to add items to arrays
  const addToArray = (field: keyof MedicationDatabase, value: string, clearInput: () => void) => {
    if (value.trim()) {
      const currentArray = (formData[field] as string[]) || [];
      setFormData({
        ...formData,
        [field]: [...currentArray, value.trim()],
      });
      clearInput();
    }
  };

  const removeFromArray = (field: keyof MedicationDatabase, index: number) => {
    const currentArray = (formData[field] as string[]) || [];
    setFormData({
      ...formData,
      [field]: currentArray.filter((_, i) => i !== index),
    });
  };

  const toggleUnit = (unit: Unit) => {
    const currentUnits = formData.applicableUnits || [];
    if (currentUnits.includes(unit)) {
      setFormData({
        ...formData,
        applicableUnits: currentUnits.filter(u => u !== unit),
      });
    } else {
      setFormData({
        ...formData,
        applicableUnits: [...currentUnits, unit],
      });
    }
  };

  if (loading) {
    return <LoadingOverlay message="Loading medications..." />;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      {saving && <LoadingOverlay message={saveMessage} />}

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-500 to-blue-600 px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm p-2 sm:p-3 rounded-xl">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">Medication Management</h2>
              <p className="text-xs sm:text-sm text-sky-100">Manage NICU/PICU medication database</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-xl transition-all"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search and Filter Bar */}
        {!showForm && (
          <div className="px-4 sm:px-6 py-4 bg-sky-50 border-b-2 border-sky-200 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search medications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border-2 border-sky-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
                <svg className="w-5 h-5 text-sky-600 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as MedicationCategory | 'All')}
                className="px-4 py-2 border-2 border-sky-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              >
                <option value="All">All Categories</option>
                {Object.values(MedicationCategory).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="px-4 sm:px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center gap-2 justify-center whitespace-nowrap"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Add New Medication</span>
                <span className="sm:hidden">Add Med</span>
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-sky-700 font-semibold">
                Showing {filteredMedications.length} of {medications.length} medications
              </div>
              {medications.length === 0 && (
                <button
                  onClick={handleSeedDatabase}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center gap-2 text-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Seed Database ({getMedicationCount()} meds)
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {showForm ? (
            // Add/Edit Form
            <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
              <div className="bg-sky-50 border-2 border-sky-200 rounded-xl p-4 sm:p-6 space-y-5">
                <h3 className="text-lg font-bold text-sky-800 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Basic Information
                </h3>

                {/* Medication Name */}
                <div>
                  <label className="block text-sm font-bold text-sky-700 mb-2">
                    Medication Name (Generic) *
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-sky-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                    placeholder="e.g., Ampicillin"
                    required
                  />
                </div>

                {/* Brand Names */}
                <div>
                  <label className="block text-sm font-bold text-sky-700 mb-2">
                    Brand Names (Optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={brandNameInput}
                      onChange={(e) => setBrandNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addToArray('brandNames', brandNameInput, () => setBrandNameInput(''));
                        }
                      }}
                      className="flex-1 px-4 py-2 border-2 border-sky-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                      placeholder="e.g., Omnipen"
                    />
                    <button
                      type="button"
                      onClick={() => addToArray('brandNames', brandNameInput, () => setBrandNameInput(''))}
                      className="px-4 py-2 bg-sky-500 text-white rounded-lg font-bold hover:bg-sky-600"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(formData.brandNames || []).map((brand, index) => (
                      <span key={index} className="bg-sky-200 text-sky-800 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
                        {brand}
                        <button
                          type="button"
                          onClick={() => removeFromArray('brandNames', index)}
                          className="text-sky-600 hover:text-sky-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-bold text-sky-700 mb-2">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as MedicationCategory })}
                    className="w-full px-4 py-2 border-2 border-sky-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                    required
                  >
                    {Object.values(MedicationCategory).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Indication */}
                <div>
                  <label className="block text-sm font-bold text-sky-700 mb-2">
                    Primary Indication *
                  </label>
                  <textarea
                    value={formData.indication || ''}
                    onChange={(e) => setFormData({ ...formData, indication: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-sky-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                    rows={2}
                    placeholder="e.g., Bacterial infections, neonatal sepsis"
                    required
                  />
                </div>
              </div>

              {/* Dosage Information */}
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 sm:p-6 space-y-5">
                <h3 className="text-lg font-bold text-green-800 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Dosage & Administration
                </h3>

                {/* Common Doses */}
                <div>
                  <label className="block text-sm font-bold text-green-700 mb-2">
                    Common Doses
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={doseInput}
                      onChange={(e) => setDoseInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addToArray('commonDoses', doseInput, () => setDoseInput(''));
                        }
                      }}
                      className="flex-1 px-4 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., 50mg/kg"
                    />
                    <button
                      type="button"
                      onClick={() => addToArray('commonDoses', doseInput, () => setDoseInput(''))}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(formData.commonDoses || []).map((dose, index) => (
                      <span key={index} className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
                        {dose}
                        <button
                          type="button"
                          onClick={() => removeFromArray('commonDoses', index)}
                          className="text-green-600 hover:text-green-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Routes */}
                <div>
                  <label className="block text-sm font-bold text-green-700 mb-2">
                    Routes of Administration
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={routeInput}
                      onChange={(e) => setRouteInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addToArray('routes', routeInput, () => setRouteInput(''));
                        }
                      }}
                      className="flex-1 px-4 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., IV, IM, PO"
                    />
                    <button
                      type="button"
                      onClick={() => addToArray('routes', routeInput, () => setRouteInput(''))}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(formData.routes || []).map((route, index) => (
                      <span key={index} className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
                        {route}
                        <button
                          type="button"
                          onClick={() => removeFromArray('routes', index)}
                          className="text-green-600 hover:text-green-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Frequencies */}
                <div>
                  <label className="block text-sm font-bold text-green-700 mb-2">
                    Dosing Frequencies
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={frequencyInput}
                      onChange={(e) => setFrequencyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addToArray('frequencies', frequencyInput, () => setFrequencyInput(''));
                        }
                      }}
                      className="flex-1 px-4 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., BD, TID, QID"
                    />
                    <button
                      type="button"
                      onClick={() => addToArray('frequencies', frequencyInput, () => setFrequencyInput(''))}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(formData.frequencies || []).map((freq, index) => (
                      <span key={index} className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
                        {freq}
                        <button
                          type="button"
                          onClick={() => removeFromArray('frequencies', index)}
                          className="text-green-600 hover:text-green-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4 sm:p-6 space-y-5">
                <h3 className="text-lg font-bold text-purple-800 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Additional Details
                </h3>

                {/* Applicable Units */}
                <div>
                  <label className="block text-sm font-bold text-purple-700 mb-2">
                    Applicable Units
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.values(Unit).map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        onClick={() => toggleUnit(unit)}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${
                          (formData.applicableUnits || []).includes(unit)
                            ? 'bg-purple-500 text-white shadow-lg'
                            : 'bg-white text-purple-700 border-2 border-purple-300 hover:border-purple-500'
                        }`}
                      >
                        {unit}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Age Groups */}
                <div>
                  <label className="block text-sm font-bold text-purple-700 mb-2">
                    Age Groups
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={ageGroupInput}
                      onChange={(e) => setAgeGroupInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addToArray('ageGroups', ageGroupInput, () => setAgeGroupInput(''));
                        }
                      }}
                      className="flex-1 px-4 py-2 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., Newborn, Preterm"
                    />
                    <button
                      type="button"
                      onClick={() => addToArray('ageGroups', ageGroupInput, () => setAgeGroupInput(''))}
                      className="px-4 py-2 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(formData.ageGroups || []).map((age, index) => (
                      <span key={index} className="bg-purple-200 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
                        {age}
                        <button
                          type="button"
                          onClick={() => removeFromArray('ageGroups', index)}
                          className="text-purple-600 hover:text-purple-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Warnings */}
                <div>
                  <label className="block text-sm font-bold text-purple-700 mb-2">
                    Warnings / Contraindications
                  </label>
                  <textarea
                    value={formData.warnings || ''}
                    onChange={(e) => setFormData({ ...formData, warnings: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    rows={2}
                    placeholder="e.g., Avoid in penicillin allergy, monitor renal function"
                  />
                </div>

                {/* Search Terms */}
                <div>
                  <label className="block text-sm font-bold text-purple-700 mb-2">
                    Additional Search Terms (for better autocomplete)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchTermInput}
                      onChange={(e) => setSearchTermInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addToArray('searchTerms', searchTermInput, () => setSearchTermInput(''));
                        }
                      }}
                      className="flex-1 px-4 py-2 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., abx, antibiotic"
                    />
                    <button
                      type="button"
                      onClick={() => addToArray('searchTerms', searchTermInput, () => setSearchTermInput(''))}
                      className="px-4 py-2 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(formData.searchTerms || []).map((term, index) => (
                      <span key={index} className="bg-purple-200 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
                        {term}
                        <button
                          type="button"
                          onClick={() => removeFromArray('searchTerms', index)}
                          className="text-purple-600 hover:text-purple-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
                >
                  {editingMed ? 'Update Medication' : 'Add Medication'}
                </button>
              </div>
            </form>
          ) : (
            // Medications List
            <div className="space-y-3">
              {filteredMedications.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-slate-500 text-lg font-semibold">No medications found</p>
                  <p className="text-slate-400 text-sm">Try adjusting your search or filters</p>
                </div>
              ) : (
                filteredMedications.map((med) => (
                  <div
                    key={med.id}
                    className="bg-white border-2 border-sky-200 rounded-xl p-4 hover:border-sky-400 hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-bold text-slate-900">{med.name}</h3>
                          <span className="px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-xs font-bold">
                            {med.category}
                          </span>
                          {!med.isActive && (
                            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                              Inactive
                            </span>
                          )}
                        </div>

                        {med.brandNames && med.brandNames.length > 0 && (
                          <p className="text-sm text-slate-600">
                            <span className="font-semibold">Brand names:</span> {med.brandNames.join(', ')}
                          </p>
                        )}

                        <p className="text-sm text-slate-700">
                          <span className="font-semibold">Indication:</span> {med.indication}
                        </p>

                        {med.commonDoses && med.commonDoses.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            <span className="text-xs font-semibold text-slate-600">Doses:</span>
                            {med.commonDoses.map((dose, i) => (
                              <span key={i} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">
                                {dose}
                              </span>
                            ))}
                          </div>
                        )}

                        {med.routes && med.routes.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            <span className="text-xs font-semibold text-slate-600">Routes:</span>
                            {med.routes.map((route, i) => (
                              <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                                {route}
                              </span>
                            ))}
                          </div>
                        )}

                        {med.warnings && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                            <p className="text-xs text-amber-800">
                              <span className="font-bold">⚠️ Warning:</span> {med.warnings}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(med)}
                          className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-all"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(med.id)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicationManagementPanel;
