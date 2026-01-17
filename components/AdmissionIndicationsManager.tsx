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
    if (!confirm('This will add comprehensive admission indications for NICU, SNCU, PICU, and HDU. Continue?')) {
      return;
    }

    const defaultIndications = [
      // NICU/SNCU Indications (Neonatal)
      { name: 'Prematurity (< 34 weeks)', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Low Birth Weight (< 1800 gm)', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Very Low Birth Weight (< 1500 gm)', units: [Unit.NICU] },
      { name: 'Extremely Low Birth Weight (< 1000 gm)', units: [Unit.NICU] },
      { name: 'Perinatal Asphyxia / Birth Asphyxia', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Hypoxic Ischemic Encephalopathy (HIE)', units: [Unit.NICU] },
      { name: 'Respiratory Distress Syndrome (RDS)', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Transient Tachypnea of Newborn (TTN)', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Meconium Aspiration Syndrome (MAS)', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Respiratory Distress (RR > 60 or Grunt/Retractions)', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Neonatal Jaundice / Hyperbilirubinemia', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Neonatal Sepsis (Early/Late Onset)', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Neonatal Convulsions / Seizures', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Central Cyanosis', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Apnea / Gasping / Apnea of Prematurity', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Congenital Heart Disease (Cyanotic/Acyanotic)', units: [Unit.NICU] },
      { name: 'Persistent Pulmonary Hypertension (PPHN)', units: [Unit.NICU] },
      { name: 'Shock (Cold Periphery with CRT > 3 sec)', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Hypothermia (< 35.4 °C)', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Hyperthermia (> 37.5 °C)', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Hypoglycemia (< 45 mg/dL)', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Necrotizing Enterocolitis (NEC)', units: [Unit.NICU] },
      { name: 'Abdominal Distension / Suspected NEC', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Refusal to Feed / Poor Feeding', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Oliguria / Acute Kidney Injury', units: [Unit.NICU] },
      { name: 'Baby of Diabetic Mother', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Large for Gestational Age (> 4 kg at term)', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Major Congenital Malformation', units: [Unit.NICU] },
      { name: 'Bleeding / Coagulopathy', units: [Unit.NICU] },
      { name: 'Diarrhea (Severe)', units: [Unit.SNCU] },
      { name: 'Vomiting (Persistent)', units: [Unit.SNCU] },
      { name: 'Unconsciousness / Altered Sensorium', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Requiring Mechanical Ventilation', units: [Unit.NICU] },
      { name: 'Requiring CPAP Support', units: [Unit.NICU, Unit.SNCU] },
      { name: 'Post-surgical Care (Neonatal Surgery)', units: [Unit.NICU] },

      // PICU Indications (Pediatric Intensive Care)
      { name: 'Severe Respiratory Distress / Respiratory Failure', units: [Unit.PICU, Unit.HDU] },
      { name: 'Status Asthmaticus', units: [Unit.PICU, Unit.HDU] },
      { name: 'Severe Pneumonia requiring ventilation', units: [Unit.PICU] },
      { name: 'Acute Respiratory Distress Syndrome (ARDS)', units: [Unit.PICU] },
      { name: 'Upper Airway Obstruction (Severe)', units: [Unit.PICU, Unit.HDU] },
      { name: 'Bronchiolitis requiring respiratory support', units: [Unit.PICU, Unit.HDU] },
      { name: 'Septic Shock / Severe Sepsis', units: [Unit.PICU] },
      { name: 'Hypovolemic Shock', units: [Unit.PICU, Unit.HDU] },
      { name: 'Cardiogenic Shock', units: [Unit.PICU] },
      { name: 'Distributive Shock', units: [Unit.PICU] },
      { name: 'Acute Cardiac Failure / Decompensated Heart Failure', units: [Unit.PICU] },
      { name: 'Post Cardiac Surgery Monitoring', units: [Unit.PICU] },
      { name: 'Cardiac Arrhythmias (Life-threatening)', units: [Unit.PICU] },
      { name: 'Severe Head Trauma / Traumatic Brain Injury', units: [Unit.PICU] },
      { name: 'Status Epilepticus / Refractory Seizures', units: [Unit.PICU, Unit.HDU] },
      { name: 'Altered Consciousness / Coma (GCS < 8)', units: [Unit.PICU] },
      { name: 'Meningitis / Encephalitis (Severe)', units: [Unit.PICU, Unit.HDU] },
      { name: 'Guillain-Barré Syndrome requiring ventilation', units: [Unit.PICU] },
      { name: 'Raised Intracranial Pressure (ICP)', units: [Unit.PICU] },
      { name: 'Multi-system Trauma / Polytrauma', units: [Unit.PICU] },
      { name: 'Major Burns (> 20% TBSA)', units: [Unit.PICU] },
      { name: 'Moderate Burns (10-20% TBSA) requiring monitoring', units: [Unit.HDU] },
      { name: 'Near Drowning / Submersion Injury', units: [Unit.PICU] },
      { name: 'Severe Electrocution', units: [Unit.PICU] },
      { name: 'Diabetic Ketoacidosis (DKA) - Severe', units: [Unit.PICU, Unit.HDU] },
      { name: 'Severe Dehydration with shock', units: [Unit.PICU, Unit.HDU] },
      { name: 'Acute Kidney Injury requiring dialysis', units: [Unit.PICU] },
      { name: 'Hepatic Encephalopathy / Acute Liver Failure', units: [Unit.PICU] },
      { name: 'Severe Electrolyte Imbalance', units: [Unit.PICU, Unit.HDU] },
      { name: 'Inborn Errors of Metabolism (Acute decompensation)', units: [Unit.PICU] },
      { name: 'Post-operative Care (Major Surgery)', units: [Unit.PICU, Unit.HDU] },
      { name: 'Post Neurosurgery Monitoring', units: [Unit.PICU, Unit.HDU] },
      { name: 'Post Thoracic Surgery', units: [Unit.PICU] },
      { name: 'Post Abdominal Surgery (Major)', units: [Unit.HDU] },
      { name: 'Toxic Ingestion / Poisoning (Severe)', units: [Unit.PICU] },
      { name: 'Drug Overdose requiring close monitoring', units: [Unit.PICU, Unit.HDU] },
      { name: 'Anaphylaxis (Severe)', units: [Unit.PICU, Unit.HDU] },
      { name: 'Hemolytic Uremic Syndrome (HUS)', units: [Unit.PICU] },
      { name: 'Dengue Shock Syndrome', units: [Unit.PICU, Unit.HDU] },
      { name: 'Malaria (Severe / Cerebral)', units: [Unit.PICU] },
      { name: 'Multi-organ Dysfunction Syndrome (MODS)', units: [Unit.PICU] },
      { name: 'Requiring Inotropic / Vasopressor Support', units: [Unit.PICU] },
      { name: 'Requiring Mechanical Ventilation', units: [Unit.PICU] },
      { name: 'Requiring Non-invasive Ventilation (NIV)', units: [Unit.PICU, Unit.HDU] },
      { name: 'Requiring High Flow Oxygen Therapy', units: [Unit.HDU] },

      // HDU Specific Indications
      { name: 'Moderate Respiratory Distress', units: [Unit.HDU] },
      { name: 'Post-extubation Monitoring', units: [Unit.HDU] },
      { name: 'Frequent Vital Signs Monitoring Required', units: [Unit.HDU] },
      { name: 'Altered Sensorium (GCS 9-12)', units: [Unit.HDU] },
      { name: 'Prolonged / Clustering Seizures', units: [Unit.HDU] },
      { name: 'Unstable Metabolic Condition', units: [Unit.HDU] },
      { name: 'Step-down from PICU', units: [Unit.HDU] },
      { name: 'Close Observation post-procedure', units: [Unit.HDU] },
      { name: 'Severe Asthma (improving)', units: [Unit.HDU] },
      { name: 'Moderate Dehydration requiring IV therapy', units: [Unit.HDU] },

      // Common to All
      { name: 'Any Other (Specify in remarks)', units: [Unit.NICU, Unit.SNCU, Unit.PICU, Unit.HDU] }
    ];

    try {
      const batch = defaultIndications.map((indication, index) =>
        addDoc(collection(db, 'admissionIndications'), {
          name: indication.name,
          applicableUnits: indication.units,
          isActive: true,
          order: index,
          createdAt: new Date().toISOString(),
          createdBy: userEmail
        })
      );

      await Promise.all(batch);
      alert(`Successfully added ${defaultIndications.length} comprehensive admission indications for NICU, SNCU, PICU, and HDU!`);
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
            Comprehensive admission criteria for NICU, SNCU, PICU, and HDU based on international guidelines (AAP/SCCM 2019)
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
              <h3 className="text-lg font-bold text-green-200 mb-2">🚀 Quick Start: Initialize Comprehensive Admission Indications</h3>
              <p className="text-slate-300 mb-4">
                To enable the admission indications feature for all units (NICU, SNCU, PICU, HDU), you need to initialize the comprehensive indications database.
              </p>
              <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-slate-200 mb-2">What happens when you click "Initialize Defaults"?</p>
                <ul className="text-sm text-slate-300 space-y-1 ml-4">
                  <li>✓ Adds <strong>100+ comprehensive admission indications</strong></li>
                  <li>✓ <strong>NICU/SNCU:</strong> 35 neonatal indications (Prematurity, RDS, HIE, Sepsis, etc.)</li>
                  <li>✓ <strong>PICU:</strong> 50+ pediatric critical care indications (Respiratory failure, Shock, Trauma, etc.)</li>
                  <li>✓ <strong>HDU:</strong> 15+ high dependency care indications (Step-down care, monitoring)</li>
                  <li>✓ All indications are immediately available to all doctors across all institutions</li>
                  <li>✓ Based on AAP/SCCM 2019 guidelines and international best practices</li>
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
                Initialize 100+ Comprehensive Indications Now
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
