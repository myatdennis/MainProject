import React, { useState } from 'react';
import { X, Building2, Users, Check } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  type: string;
  learners: number;
}

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizations: Organization[];
  selectedOrganizations: string[];
  onSave: (organizationIds: string[]) => void;
}

const AssignmentModal: React.FC<AssignmentModalProps> = ({
  isOpen,
  onClose,
  organizations,
  selectedOrganizations,
  onSave
}) => {
  const [tempSelected, setTempSelected] = useState<string[]>(selectedOrganizations);

  if (!isOpen) return null;

  const handleToggleOrganization = (orgId: string) => {
    setTempSelected(prev => 
      prev.includes(orgId) 
        ? prev.filter(id => id !== orgId)
        : [...prev, orgId]
    );
  };

  const handleSave = () => {
    onSave(tempSelected);
    onClose();
  };

  const totalSelectedLearners = organizations
    .filter(org => tempSelected.includes(org.id))
    .reduce((sum, org) => sum + org.learners, 0);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assignment-modal-title"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 id="assignment-modal-title" className="text-xl font-bold text-gray-900">
                Assign Survey to Organizations
              </h2>
              <p className="text-sm text-gray-600">
                Select organizations that should receive this survey
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            aria-label="Close assignment modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Selected Organizations:</span>
              <span className="font-medium text-gray-900">{tempSelected.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-gray-600">Total Learners:</span>
              <span className="font-medium text-blue-600">{totalSelectedLearners}</span>
            </div>
          </div>

          <div className="space-y-3">
            {organizations.map((org) => {
              const isSelected = tempSelected.includes(org.id);
              return (
                <div
                  key={org.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-blue-300 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleToggleOrganization(org.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected 
                          ? 'bg-blue-600 border-blue-600' 
                          : 'border-gray-300'
                      }`}>
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{org.name}</h3>
                        <p className="text-sm text-gray-600">{org.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-1 text-sm text-gray-600">
                        <Users className="h-4 w-4" />
                        <span>{org.learners} learners</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save Assignment ({tempSelected.length} organizations)
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignmentModal;