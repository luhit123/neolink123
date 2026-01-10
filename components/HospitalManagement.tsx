import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Hospital, Unit, BedCapacity } from '../types';

interface HospitalManagementProps {
  userEmail: string;
  onBack: () => void;
}

const HospitalManagement: React.FC<HospitalManagementProps> = ({ userEmail, onBack }) => {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('All');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    contactNumber: '',
    email: '',
    district: '',
    state: '',
    pincode: '',
    institutionType: '',
    isActive: true,
    facilities: [] as Unit[],
    bedCapacity: {
      PICU: 0,
      NICU: 0,
      NICU_INBORN: 0,
      NICU_OUTBORN: 0,
      SNCU: 0,
      HDU: 0,
      GENERAL_WARD: 0
    } as BedCapacity
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load hospitals from Firestore
  useEffect(() => {
    const q = query(collection(db, 'hospitals'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const hospitalData: Hospital[] = [];
      snapshot.forEach((doc) => {
        hospitalData.push({ id: doc.id, ...doc.data() } as Hospital);
      });
      setHospitals(hospitalData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Get unique districts
  const districts = useMemo(() => {
    const uniqueDistricts = new Set(hospitals.map(h => h.district).filter(Boolean));
    return ['All', ...Array.from(uniqueDistricts).sort()];
  }, [hospitals]);

  // Filter hospitals
  const filteredHospitals = useMemo(() => {
    return hospitals.filter(hospital => {
      const matchesSearch =
        hospital.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hospital.district?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hospital.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDistrict = filterDistrict === 'All' || hospital.district === filterDistrict;

      return matchesSearch && matchesDistrict;
    });
  }, [hospitals, searchTerm, filterDistrict]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleFacilityToggle = (facility: Unit) => {
    setFormData(prev => {
      const facilities = prev.facilities.includes(facility)
        ? prev.facilities.filter(f => f !== facility)
        : [...prev.facilities, facility];
      return { ...prev, facilities };
    });
  };

  const handleBedCapacityChange = (unit: keyof BedCapacity, value: string) => {
    const numValue = parseInt(value) || 0;
    setFormData(prev => ({
      ...prev,
      bedCapacity: {
        ...prev.bedCapacity,
        [unit]: numValue
      }
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Hospital name is required';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (!formData.contactNumber.trim()) newErrors.contactNumber = 'Contact number is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.district.trim()) newErrors.district = 'District is required';
    if (!formData.state.trim()) newErrors.state = 'State is required';
    if (formData.facilities.length === 0) newErrors.facilities = 'Select at least one facility';

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      if (editingHospital) {
        // Update existing hospital
        await updateDoc(doc(db, 'hospitals', editingHospital.id), {
          name: formData.name,
          address: formData.address,
          contactNumber: formData.contactNumber,
          email: formData.email,
          district: formData.district,
          state: formData.state,
          pincode: formData.pincode,
          institutionType: formData.institutionType,
          facilities: formData.facilities,
          bedCapacity: formData.bedCapacity,
          isActive: formData.isActive
        });
        alert('Hospital updated successfully!');
      } else {
        // Add new hospital
        await addDoc(collection(db, 'hospitals'), {
          name: formData.name,
          address: formData.address,
          contactNumber: formData.contactNumber,
          email: formData.email,
          district: formData.district,
          state: formData.state,
          pincode: formData.pincode,
          institutionType: formData.institutionType,
          facilities: formData.facilities,
          bedCapacity: formData.bedCapacity,
          isActive: formData.isActive,
          createdAt: new Date().toISOString(),
          createdBy: userEmail
        });
        alert('Hospital added successfully!');
      }

      // Reset form
      resetForm();
      setShowForm(false);
    } catch (error) {
      console.error('Error saving hospital:', error);
      alert('Failed to save hospital. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      contactNumber: '',
      email: '',
      district: '',
      state: '',
      pincode: '',
      institutionType: '',
      isActive: true,
      facilities: [],
      bedCapacity: {
        PICU: 0,
        NICU: 0,
        NICU_INBORN: 0,
        NICU_OUTBORN: 0,
        SNCU: 0,
        HDU: 0,
        GENERAL_WARD: 0
      }
    });
    setEditingHospital(null);
    setErrors({});
  };

  const handleEdit = (hospital: Hospital) => {
    setEditingHospital(hospital);
    setFormData({
      name: hospital.name,
      address: hospital.address,
      contactNumber: hospital.contactNumber,
      email: hospital.email,
      district: hospital.district || '',
      state: hospital.state || '',
      pincode: hospital.pincode || '',
      institutionType: hospital.institutionType || '',
      isActive: hospital.isActive,
      facilities: hospital.facilities,
      bedCapacity: hospital.bedCapacity || {
        PICU: 0,
        NICU: 0,
        NICU_INBORN: 0,
        NICU_OUTBORN: 0,
        SNCU: 0,
        HDU: 0,
        GENERAL_WARD: 0
      }
    });
    setShowForm(true);
  };

  const handleToggleActive = async (hospital: Hospital) => {
    try {
      await updateDoc(doc(db, 'hospitals', hospital.id), {
        isActive: !hospital.isActive
      });
    } catch (error) {
      console.error('Error toggling hospital status:', error);
      alert('Failed to update hospital status.');
    }
  };

  const institutionTypes = [
    'Medical College',
    'District Hospital',
    'Community Health Centre (CHC)',
    'Primary Health Centre (PHC)',
    'Sub District Hospital',
    'Specialized Hospital',
    'Private Hospital',
    'Government Hospital',
    'Other'
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-sky-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-sky-600 mx-auto mb-4"></div>
          <p className="text-sky-900 font-semibold">Loading hospitals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sky-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg sticky top-0 z-30">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-all duration-200 backdrop-blur-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="font-semibold">Back</span>
            </button>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold">Hospital Management</h1>
              <p className="text-sky-100 text-sm md:text-base">Manage hospitals and referral network</p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="flex items-center gap-2 bg-white text-sky-600 hover:bg-sky-50 px-6 py-3 rounded-lg transition-all duration-200 font-semibold shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Hospital
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-lg border border-sky-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-sky-900">
                {editingHospital ? 'Edit Hospital' : 'Add New Hospital'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-sky-900 mb-2">
                    Hospital Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      errors.name ? 'border-red-500' : 'border-sky-200'
                    }`}
                    placeholder="Enter hospital name"
                  />
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-sky-900 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      errors.email ? 'border-red-500' : 'border-sky-200'
                    }`}
                    placeholder="hospital@example.com"
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-sky-900 mb-2">
                    Contact Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="contactNumber"
                    value={formData.contactNumber}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      errors.contactNumber ? 'border-red-500' : 'border-sky-200'
                    }`}
                    placeholder="Enter contact number"
                  />
                  {errors.contactNumber && <p className="text-red-500 text-sm mt-1">{errors.contactNumber}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-sky-900 mb-2">
                    Institution Type
                  </label>
                  <select
                    name="institutionType"
                    value={formData.institutionType}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">Select type</option>
                    {institutionTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-semibold text-sky-900 mb-2">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows={3}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                    errors.address ? 'border-red-500' : 'border-sky-200'
                  }`}
                  placeholder="Enter full address"
                />
                {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
              </div>

              {/* Location Details */}
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-sky-900 mb-2">
                    District <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="district"
                    value={formData.district}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      errors.district ? 'border-red-500' : 'border-sky-200'
                    }`}
                    placeholder="Enter district"
                  />
                  {errors.district && <p className="text-red-500 text-sm mt-1">{errors.district}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-sky-900 mb-2">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      errors.state ? 'border-red-500' : 'border-sky-200'
                    }`}
                    placeholder="Enter state"
                  />
                  {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-sky-900 mb-2">
                    Pincode
                  </label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="Enter pincode"
                  />
                </div>
              </div>

              {/* Facilities */}
              <div>
                <label className="block text-sm font-semibold text-sky-900 mb-2">
                  Available Facilities <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {Object.values(Unit).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => handleFacilityToggle(unit)}
                      className={`px-4 py-3 rounded-lg border-2 transition-all duration-200 text-sm font-semibold ${
                        formData.facilities.includes(unit)
                          ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white border-sky-500'
                          : 'bg-white text-sky-700 border-sky-200 hover:border-sky-400'
                      }`}
                    >
                      {unit === Unit.NICU ? 'NICU' : unit === Unit.PICU ? 'PICU' : unit === Unit.SNCU ? 'SNCU' : unit === Unit.HDU ? 'HDU' : 'General Ward'}
                    </button>
                  ))}
                </div>
                {errors.facilities && <p className="text-red-500 text-sm mt-1">{errors.facilities}</p>}
              </div>

              {/* Bed Capacity */}
              <div>
                <label className="block text-sm font-semibold text-sky-900 mb-3">
                  Bed Capacity (Optional)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.keys(formData.bedCapacity).map((unit) => {
                    // Skip legacy NICU field
                    if (unit === 'NICU') return null;

                    const getLabel = () => {
                      if (unit === 'PICU') return 'PICU';
                      if (unit === 'NICU_INBORN') return 'NICU Inborn';
                      if (unit === 'NICU_OUTBORN') return 'NICU Outborn';
                      if (unit === 'SNCU') return 'SNCU';
                      if (unit === 'HDU') return 'HDU';
                      if (unit === 'GENERAL_WARD') return 'General Ward';
                      return unit;
                    };

                    return (
                      <div key={unit}>
                        <label className="block text-xs text-sky-700 mb-1 font-medium">
                          {getLabel()}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.bedCapacity[unit as keyof BedCapacity] || 0}
                          onChange={(e) => handleBedCapacityChange(unit as keyof BedCapacity, e.target.value)}
                          className="w-full px-3 py-2 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                          placeholder="0"
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  💡 For NICU, set separate bed counts for Inborn and Outborn patients
                </p>
              </div>

              {/* Active Status */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-5 h-5 text-sky-600 border-sky-300 rounded focus:ring-sky-500"
                />
                <label htmlFor="isActive" className="text-sm font-semibold text-sky-900">
                  Hospital is active and can receive referrals
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white px-6 py-3 rounded-lg transition-all duration-200 font-semibold shadow-lg"
                >
                  {editingHospital ? 'Update Hospital' : 'Add Hospital'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="px-6 py-3 border-2 border-sky-300 text-sky-700 rounded-lg hover:bg-sky-50 transition-all duration-200 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search and Filter */}
        <div className="bg-white rounded-xl shadow-md border border-sky-200 p-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-sky-900 mb-2">Search Hospitals</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, district, or email..."
                  className="w-full pl-10 pr-4 py-2 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <svg
                  className="absolute left-3 top-3 w-5 h-5 text-sky-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-sky-900 mb-2">Filter by District</label>
              <select
                value={filterDistrict}
                onChange={(e) => setFilterDistrict(e.target.value)}
                className="w-full px-4 py-2 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {districts.map(district => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Hospitals List */}
        <div className="bg-gradient-to-r from-sky-500 to-blue-500 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <div>
              <h3 className="text-sm opacity-90">Total Hospitals</h3>
              <p className="text-3xl font-bold">{filteredHospitals.length}</p>
            </div>
          </div>
        </div>

        {/* Hospital Cards */}
        {filteredHospitals.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHospitals.map((hospital) => (
              <div
                key={hospital.id}
                className="bg-white rounded-xl shadow-md border border-sky-200 p-6 hover:shadow-xl transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-sky-900 mb-1">{hospital.name}</h3>
                    <p className="text-sm text-sky-600">{hospital.institutionType || 'Hospital'}</p>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      hospital.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {hospital.isActive ? 'Active' : 'Inactive'}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-sky-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">{hospital.address}</p>
                      <p className="text-sm text-sky-600">{hospital.district}, {hospital.state} {hospital.pincode}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <p className="text-sm text-gray-700">{hospital.contactNumber}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-gray-700">{hospital.email}</p>
                  </div>
                </div>

                {/* Facilities */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-sky-700 mb-2">Facilities:</p>
                  <div className="flex flex-wrap gap-2">
                    {hospital.facilities.map((facility) => (
                      <span
                        key={facility}
                        className="px-2 py-1 bg-sky-100 text-sky-700 rounded text-xs font-semibold"
                      >
                        {facility === Unit.NICU ? 'NICU' : facility === Unit.PICU ? 'PICU' : facility === Unit.SNCU ? 'SNCU' : facility === Unit.HDU ? 'HDU' : 'General'}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bed Capacity */}
                {hospital.bedCapacity && (
                  <div className="mb-4 p-3 bg-sky-50 rounded-lg">
                    <p className="text-xs font-semibold text-sky-700 mb-2">Bed Capacity:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(hospital.bedCapacity).map(([unit, capacity]) => {
                        // Skip legacy NICU field and zero capacity
                        if (unit === 'NICU' || capacity === 0) return null;

                        const getLabel = () => {
                          if (unit === 'PICU') return 'PICU';
                          if (unit === 'NICU_INBORN') return 'NICU Inborn';
                          if (unit === 'NICU_OUTBORN') return 'NICU Outborn';
                          if (unit === 'SNCU') return 'SNCU';
                          if (unit === 'HDU') return 'HDU';
                          if (unit === 'GENERAL_WARD') return 'General Ward';
                          return unit;
                        };

                        return (
                          <div key={unit} className="flex justify-between">
                            <span className="text-sky-600">{getLabel()}:</span>
                            <span className="font-semibold text-sky-900">{capacity}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(hospital)}
                    className="flex-1 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg transition-all duration-200 font-semibold text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(hospital)}
                    className={`flex-1 px-4 py-2 rounded-lg transition-all duration-200 font-semibold text-sm ${
                      hospital.isActive
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {hospital.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md border-2 border-dashed border-sky-300 p-12 text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-sky-100 p-6 rounded-full">
                <svg className="w-16 h-16 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-sky-900 mb-2">No Hospitals Found</h3>
            <p className="text-sky-600 mb-6">
              {searchTerm || filterDistrict !== 'All'
                ? 'No hospitals match your search criteria.'
                : 'Start by adding hospitals to the referral network.'}
            </p>
            {(searchTerm || filterDistrict !== 'All') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterDistrict('All');
                }}
                className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-lg transition-all duration-200 font-semibold shadow-md"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HospitalManagement;
