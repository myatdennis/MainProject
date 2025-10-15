import React, { useState, useRef } from 'react';
import { Upload, Download, Mail, Award, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface BulkOperation {
  id: string;
  type: 'import' | 'export' | 'assign' | 'email' | 'certificate';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  total: number;
  processed: number;
  errors: string[];
  startTime: Date;
  endTime?: Date;
}

const BulkOperationsCenter: React.FC = () => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [operations, setOperations] = useState<BulkOperation[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);

  const mockUsers = [
    'Sarah Chen', 'Mike Johnson', 'Emma Davis', 'Alex Rodriguez', 'Lisa Thompson'
  ];

  const mockCourses = [
    'Inclusive Leadership', 'Bias Awareness', 'Cultural Intelligence', 'Communication Skills'
  ];

  const startOperation = (type: BulkOperation['type'], description: string) => {
    const newOperation: BulkOperation = {
      id: Date.now().toString(),
      type,
      status: 'processing',
      progress: 0,
      total: 100,
      processed: 0,
      errors: [],
      startTime: new Date()
    };

    setOperations(prev => [newOperation, ...prev]);

    // Simulate progress
    const interval = setInterval(() => {
      setOperations(prev => prev.map(op => {
        if (op.id === newOperation.id && op.status === 'processing') {
          const newProcessed = Math.min(op.processed + Math.random() * 10, op.total);
          const newProgress = (newProcessed / op.total) * 100;
          
          if (newProcessed >= op.total) {
            clearInterval(interval);
            showToast(`${description} completed successfully!`, 'success');
            return {
              ...op,
              status: 'completed' as const,
              progress: 100,
              processed: op.total,
              endTime: new Date()
            };
          }
          
          return {
            ...op,
            progress: newProgress,
            processed: newProcessed
          };
        }
        return op;
      }));
    }, 500);

    showToast(`${description} started...`, 'info');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
        showToast('Please upload a CSV or Excel file', 'error');
        return;
      }
      startOperation('import', `Importing users from ${file.name}`);
    }
  };

  const handleBulkAssignment = () => {
    if (selectedUsers.length === 0 || selectedCourses.length === 0) {
      showToast('Please select users and courses', 'error');
      return;
    }
    startOperation('assign', `Assigning ${selectedCourses.length} courses to ${selectedUsers.length} users`);
  };

  const handleBulkEmail = () => {
    if (selectedUsers.length === 0) {
      showToast('Please select users to email', 'error');
      return;
    }
    startOperation('email', `Sending emails to ${selectedUsers.length} users`);
  };

  const handleBulkCertificates = () => {
    if (selectedUsers.length === 0) {
      showToast('Please select users for certificates', 'error');
      return;
    }
    startOperation('certificate', `Generating certificates for ${selectedUsers.length} users`);
  };

  const exportUsers = () => {
    startOperation('export', 'Exporting user data');
  };

  const getStatusIcon = (status: BulkOperation['status']) => {
    switch (status) {
      case 'processing':
        return <Loader className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <div className="w-4 h-4 bg-gray-300 rounded-full" />;
    }
  };

  const getOperationName = (type: BulkOperation['type']) => {
    switch (type) {
      case 'import': return 'User Import';
      case 'export': return 'Data Export';
      case 'assign': return 'Course Assignment';
      case 'email': return 'Bulk Email';
      case 'certificate': return 'Certificate Generation';
      default: return 'Operation';
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Bulk Operations Center</h2>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Import Users */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <Upload className="w-5 h-5 text-blue-500 mr-2" />
            <h3 className="font-semibold text-gray-900">Import Users</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Upload CSV or Excel file with user data</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Upload File
          </button>
        </div>

        {/* Export Data */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <Download className="w-5 h-5 text-green-500 mr-2" />
            <h3 className="font-semibold text-gray-900">Export Data</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Download user and course data</p>
          <button
            onClick={exportUsers}
            className="w-full bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
          >
            Export CSV
          </button>
        </div>

        {/* Bulk Email */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <Mail className="w-5 h-5 text-orange-500 mr-2" />
            <h3 className="font-semibold text-gray-900">Send Emails</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Send notifications to multiple users</p>
          <button
            onClick={handleBulkEmail}
            className="w-full bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors"
          >
            Send Bulk Email
          </button>
        </div>

        {/* Generate Certificates */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <Award className="w-5 h-5 text-purple-500 mr-2" />
            <h3 className="font-semibold text-gray-900">Certificates</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Generate certificates in bulk</p>
          <button
            onClick={handleBulkCertificates}
            className="w-full bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors"
          >
            Generate Certificates
          </button>
        </div>
      </div>

      {/* Selection Panel */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Selection Panel</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Users ({selectedUsers.length} selected)
            </label>
            <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto">
              {mockUsers.map(user => (
                <label key={user} className="flex items-center space-x-2 p-1">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUsers(prev => [...prev, user]);
                      } else {
                        setSelectedUsers(prev => prev.filter(u => u !== user));
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{user}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Course Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Courses ({selectedCourses.length} selected)
            </label>
            <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto">
              {mockCourses.map(course => (
                <label key={course} className="flex items-center space-x-2 p-1">
                  <input
                    type="checkbox"
                    checked={selectedCourses.includes(course)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCourses(prev => [...prev, course]);
                      } else {
                        setSelectedCourses(prev => prev.filter(c => c !== course));
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{course}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={handleBulkAssignment}
            className="bg-indigo-500 text-white px-6 py-2 rounded-lg hover:bg-indigo-600 transition-colors"
          >
            Assign Selected Courses to Selected Users
          </button>
        </div>
      </div>

      {/* Operations History */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Operation History</h3>
        {operations.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No operations yet</p>
        ) : (
          <div className="space-y-3">
            {operations.map(operation => (
              <div key={operation.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(operation.status)}
                    <span className="font-medium text-gray-900">
                      {getOperationName(operation.type)}
                    </span>
                    <span className="text-sm text-gray-500">
                      {operation.startTime.toLocaleTimeString()}
                    </span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {operation.processed}/{operation.total}
                  </span>
                </div>
                {operation.status === 'processing' && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${operation.progress}%` }}
                    />
                  </div>
                )}
                {operation.status === 'completed' && operation.endTime && (
                  <p className="text-sm text-green-600">
                    Completed in {Math.round((operation.endTime.getTime() - operation.startTime.getTime()) / 1000)}s
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkOperationsCenter;