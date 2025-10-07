import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Plus, 
  X, 
  FileText, 
  Link as LinkIcon, 
  Video, 
  StickyNote, 
  ClipboardList,
  Search,
  Filter,
  User,
  Building2,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { BaseResource, UserProfile, OrganizationProfile, ResourceSendRequest } from '../models/Profile';
import profileService from '../services/ProfileService';
import documentService from '../services/documentService';

interface ResourceSenderProps {
  onResourceSent?: (resource: BaseResource, profileType: 'user' | 'organization', profileId: string) => void;
  onClose?: () => void;
  isModal?: boolean;
  preselectedProfile?: {
    type: 'user' | 'organization';
    id: string;
  };
}

const ResourceSender: React.FC<ResourceSenderProps> = ({ 
  onResourceSent, 
  onClose, 
  isModal = false,
  preselectedProfile 
}) => {
  // Form state
  const [selectedProfileType, setSelectedProfileType] = useState<'user' | 'organization'>(
    preselectedProfile?.type || 'user'
  );
  const [selectedProfileId, setSelectedProfileId] = useState<string>(preselectedProfile?.id || '');
  const [resourceType, setResourceType] = useState<BaseResource['type']>('document');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<BaseResource['priority']>('medium');
  const [tags, setTags] = useState<string>('');
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [message, setMessage] = useState('');
  const [notifyRecipient, setNotifyRecipient] = useState(true);

  // Data state
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [orgProfiles, setOrgProfiles] = useState<OrganizationProfile[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  
  // UI state
  const [profileSearch, setProfileSearch] = useState('');
  const [documentSearch, setDocumentSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [uploadPanelOpen, setUploadPanelOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadVisibility, setUploadVisibility] = useState<'global' | 'org' | 'user'>('global');
  const [uploadOrgId, setUploadOrgId] = useState<string>('');
  const [uploadUserId, setUploadUserId] = useState<string>('');
  const [multiRecipientMode, setMultiRecipientMode] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);

  useEffect(() => {
    loadProfiles();
    loadDocuments();
  }, []);

  const loadProfiles = async () => {
    try {
      const [users, orgs] = await Promise.all([
        profileService.listUserProfiles(),
        profileService.listOrganizationProfiles()
      ]);
      setUserProfiles(users);
      setOrgProfiles(orgs);
    } catch (error) {
      console.error('Failed to load profiles:', error);
      setError('Failed to load profiles');
    }
  };

  const loadDocuments = async () => {
    try {
      const docs = await documentService.listDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const handleUploadDocument = async () => {
    setError('');
    if (!uploadFile) {
      setError('Please select a file to upload');
      return;
    }
    if (!uploadName.trim()) {
      setError('Please provide a name for the document');
      return;
    }

    setIsLoading(true);
    try {
      const meta: any = {
        name: uploadName.trim(),
        filename: uploadFile.name,
        category: uploadCategory || 'General',
        tags: [],
        fileType: uploadFile.type,
        visibility: uploadVisibility,
      };
      if (uploadVisibility === 'org' && uploadOrgId) meta.orgId = uploadOrgId;
      if (uploadVisibility === 'user' && uploadUserId) meta.userId = uploadUserId;

      const added = await documentService.addDocument(meta, uploadFile);
      await loadDocuments();
      setSelectedDocumentId(added.id);
      setSuccess('Document uploaded and selected');
      setUploadPanelOpen(false);
      setUploadFile(null);
      setUploadName('');
      setUploadCategory('');
      setUploadVisibility('global');
      setUploadOrgId('');
      setUploadUserId('');
    } catch (err) {
      console.error('Upload failed', err);
      setError('Upload failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    if (!preselectedProfile) {
      setSelectedProfileType('user');
      setSelectedProfileId('');
    }
    setResourceType('document');
    setTitle('');
    setDescription('');
    setUrl('');
    setContent('');
    setCategory('');
    setPriority('medium');
    setTags('');
    setSelectedDocumentId('');
    setMessage('');
    setNotifyRecipient(true);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProfileId) {
      setError('Please select a profile');
      return;
    }

    if (!title.trim()) {
      setError('Please provide a title');
      return;
    }

    if (resourceType === 'document' && !selectedDocumentId) {
      setError('Please select a document');
      return;
    }

    if ((resourceType === 'link' || resourceType === 'video') && !url.trim()) {
      setError('Please provide a URL');
      return;
    }

    if (resourceType === 'note' && !content.trim()) {
      setError('Please provide content for the note');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const resourceBase: Omit<BaseResource, 'id' | 'createdAt' | 'createdBy' | 'status'> = {
        type: resourceType,
        title: title.trim(),
        description: description.trim() || undefined,
        url: (resourceType === 'link' || resourceType === 'video') ? url.trim() : undefined,
        content: resourceType === 'note' ? content.trim() : undefined,
        documentId: resourceType === 'document' ? selectedDocumentId : undefined,
        tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
        category: category.trim() || undefined,
        priority
      };

      const sendToSingle = !multiRecipientMode && selectedProfileId;

      if (multiRecipientMode) {
        // Collect recipients
        const recipients: Array<{ profileType: 'user' | 'organization'; profileId: string }> = [];
        selectedUserIds.forEach(id => recipients.push({ profileType: 'user', profileId: id }));
        selectedOrgIds.forEach(id => recipients.push({ profileType: 'organization', profileId: id }));

        if (recipients.length === 0) {
          setError('Please select at least one recipient');
          setIsLoading(false);
          return;
        }

        const results: any[] = [];
        for (const r of recipients) {
          const request: ResourceSendRequest = {
            profileType: r.profileType,
            profileId: r.profileId,
            resource: resourceBase,
            notifyRecipient,
            message: message.trim() || undefined
          };
          try {
            const created = await profileService.addResourceToProfile(request);
            results.push({ created, r });
            onResourceSent?.(created, r.profileType, r.profileId);
          } catch (err) {
            console.warn('Failed to send to', r, err);
          }
        }

        setSuccess(`Resource sent to ${results.length} recipient(s)`);
        setTimeout(() => {
          resetForm();
          if (isModal && onClose) onClose?.();
        }, 1200);
      } else if (sendToSingle) {
        const request: ResourceSendRequest = {
          profileType: selectedProfileType,
          profileId: selectedProfileId,
          resource: resourceBase,
          notifyRecipient,
          message: message.trim() || undefined
        };

        const createdResource = await profileService.addResourceToProfile(request);
        setSuccess('Resource sent successfully!');
        onResourceSent?.(createdResource, selectedProfileType, selectedProfileId);
        setTimeout(() => {
          resetForm();
          if (isModal && onClose) {
            onClose();
          }
        }, 1500);
      } else {
        setError('No recipient selected');
      }

    } catch (error) {
      console.error('Failed to send resource:', error);
      setError('Failed to send resource. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getResourceTypeIcon = (type: BaseResource['type']) => {
    switch (type) {
      case 'document': return <FileText className="h-4 w-4" />;
      case 'link': return <LinkIcon className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'note': return <StickyNote className="h-4 w-4" />;
      case 'assignment': return <ClipboardList className="h-4 w-4" />;
    }
  };

  const filteredUserProfiles = userProfiles.filter(profile =>
    profile.name.toLowerCase().includes(profileSearch.toLowerCase()) ||
    profile.email.toLowerCase().includes(profileSearch.toLowerCase()) ||
    profile.organization?.toLowerCase().includes(profileSearch.toLowerCase())
  );

  const filteredOrgProfiles = orgProfiles.filter(profile =>
    profile.name.toLowerCase().includes(profileSearch.toLowerCase()) ||
    profile.type.toLowerCase().includes(profileSearch.toLowerCase()) ||
    profile.contactPerson.toLowerCase().includes(profileSearch.toLowerCase())
  );

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(documentSearch.toLowerCase()) ||
    doc.category.toLowerCase().includes(documentSearch.toLowerCase()) ||
    doc.tags.some((tag: string) => tag.toLowerCase().includes(documentSearch.toLowerCase()))
  );

  const selectedProfile = selectedProfileType === 'user' 
    ? userProfiles.find(p => p.id === selectedProfileId)
    : orgProfiles.find(p => p.id === selectedProfileId);

  const content_component = (
    <div className={`bg-white ${isModal ? 'p-6 rounded-lg shadow-xl max-w-2xl mx-auto' : 'p-6 rounded-xl shadow-sm border border-gray-200'}`}>
      {isModal && (
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Send Resource</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}

      {!isModal && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Send Resource to Profile</h2>
          <p className="text-gray-600">Send documents, links, notes, and other resources to user or organization profiles.</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-2">
          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
          <span className="text-green-700">{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Selection */}
        {!preselectedProfile && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profile Type
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="user"
                    checked={selectedProfileType === 'user'}
                    onChange={(e) => {
                      setSelectedProfileType(e.target.value as 'user' | 'organization');
                      setSelectedProfileId('');
                    }}
                    className="mr-2"
                  />
                  <User className="h-4 w-4 mr-1" />
                  User Profile
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="organization"
                    checked={selectedProfileType === 'organization'}
                    onChange={(e) => {
                      setSelectedProfileType(e.target.value as 'user' | 'organization');
                      setSelectedProfileId('');
                    }}
                    className="mr-2"
                  />
                  <Building2 className="h-4 w-4 mr-1" />
                  Organization Profile
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search {selectedProfileType === 'user' ? 'Users' : 'Organizations'}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Search ${selectedProfileType === 'user' ? 'users' : 'organizations'}...`}
                  value={profileSearch}
                  onChange={(e) => setProfileSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select {selectedProfileType === 'user' ? 'User' : 'Organization'}
              </label>
              <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg">
                {selectedProfileType === 'user' ? (
                  filteredUserProfiles.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">No users found</div>
                  ) : (
                    filteredUserProfiles.map(profile => (
                      <label
                        key={profile.id}
                        className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <input
                          type="radio"
                          value={profile.id}
                          checked={selectedProfileId === profile.id}
                          onChange={(e) => setSelectedProfileId(e.target.value)}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{profile.name}</div>
                          <div className="text-sm text-gray-600">{profile.email}</div>
                          {profile.organization && (
                            <div className="text-xs text-gray-500">{profile.organization}</div>
                          )}
                        </div>
                      </label>
                    ))
                  )
                ) : (
                  filteredOrgProfiles.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">No organizations found</div>
                  ) : (
                    filteredOrgProfiles.map(profile => (
                      <label
                        key={profile.id}
                        className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <input
                          type="radio"
                          value={profile.id}
                          checked={selectedProfileId === profile.id}
                          onChange={(e) => setSelectedProfileId(e.target.value)}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{profile.name}</div>
                          <div className="text-sm text-gray-600">{profile.type}</div>
                          <div className="text-xs text-gray-500">{profile.contactPerson}</div>
                        </div>
                      </label>
                    ))
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Show selected profile if preselected */}
        {preselectedProfile && selectedProfile && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              {selectedProfileType === 'user' ? <User className="h-5 w-5 text-gray-600" /> : <Building2 className="h-5 w-5 text-gray-600" />}
              <div>
                <div className="font-medium text-gray-900">{selectedProfile.name}</div>
                <div className="text-sm text-gray-600">
                  {selectedProfileType === 'user' ? (selectedProfile as UserProfile).email : (selectedProfile as OrganizationProfile).type}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Resource Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Resource Type
          </label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {(['document', 'link', 'video', 'note', 'assignment'] as const).map(type => (
              <label
                key={type}
                className={`flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  resourceType === type 
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input
                  type="radio"
                  value={type}
                  checked={resourceType === type}
                  onChange={(e) => setResourceType(e.target.value as BaseResource['type'])}
                  className="sr-only"
                />
                {getResourceTypeIcon(type)}
                <span className="text-xs mt-1 capitalize">{type}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Resource Details */}
        <div className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Enter resource title"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Enter resource description"
            />
          </div>

          {/* Document Selection */}
          {resourceType === 'document' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <button type="button" onClick={() => setUploadPanelOpen(prev => !prev)} className="px-3 py-1 bg-blue-50 text-blue-700 rounded">{uploadPanelOpen ? 'Close Upload' : 'Upload Document'}</button>
                  <label className="flex items-center space-x-2 text-sm">
                    <input type="checkbox" checked={multiRecipientMode} onChange={(e) => setMultiRecipientMode(e.target.checked)} />
                    <span>Send to multiple recipients</span>
                  </label>
                </div>
                {multiRecipientMode && (
                  <div className="text-sm text-gray-500">Select users and/or organizations below</div>
                )}
              </div>

              {uploadPanelOpen && (
                <div className="mb-4 p-3 border border-dashed rounded-lg bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">File</label>
                      <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Name</label>
                      <input type="text" value={uploadName} onChange={(e) => setUploadName(e.target.value)} className="w-full p-2 border rounded" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Category</label>
                      <input type="text" value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} className="w-full p-2 border rounded" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Visibility</label>
                      <select value={uploadVisibility} onChange={(e) => setUploadVisibility(e.target.value as any)} className="w-full p-2 border rounded">
                        <option value="global">Global</option>
                        <option value="org">Organization</option>
                        <option value="user">User</option>
                      </select>
                    </div>
                  </div>
                  {uploadVisibility === 'org' && (
                    <div className="mt-3">
                      <label className="block text-sm text-gray-700 mb-1">Organization (for org visibility)</label>
                      <select value={uploadOrgId} onChange={(e) => setUploadOrgId(e.target.value)} className="w-full p-2 border rounded">
                        <option value="">Select organization</option>
                        {orgProfiles.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                      </select>
                    </div>
                  )}
                  {uploadVisibility === 'user' && (
                    <div className="mt-3">
                      <label className="block text-sm text-gray-700 mb-1">User (for user visibility)</label>
                      <select value={uploadUserId} onChange={(e) => setUploadUserId(e.target.value)} className="w-full p-2 border rounded">
                        <option value="">Select user</option>
                        {userProfiles.map(u => <option key={u.id} value={u.id}>{u.name} • {u.email}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="mt-3 flex justify-end">
                    <button type="button" onClick={handleUploadDocument} className="px-4 py-2 bg-green-600 text-white rounded">Upload</button>
                  </div>
                </div>
              )}
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Document *
              </label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={documentSearch}
                    onChange={(e) => setDocumentSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg">
                  {filteredDocuments.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">No documents found</div>
                  ) : (
                    filteredDocuments.map(doc => (
                      <label
                        key={doc.id}
                        className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <input
                          type="radio"
                          value={doc.id}
                          checked={selectedDocumentId === doc.id}
                          onChange={(e) => setSelectedDocumentId(e.target.value)}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{doc.name}</div>
                          <div className="text-sm text-gray-600">{doc.category}</div>
                          {doc.tags && doc.tags.length > 0 && (
                            <div className="text-xs text-gray-500">
                              Tags: {doc.tags.join(', ')}
                            </div>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>

                {/* Multi-recipient selection lists */}
                {multiRecipientMode && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="border p-2 rounded">
                      <div className="text-sm font-medium mb-2">Select Users</div>
                      <div className="max-h-36 overflow-y-auto">
                        {userProfiles.map(u => (
                          <label key={u.id} className="flex items-center space-x-2 p-1">
                            <input type="checkbox" value={u.id} checked={selectedUserIds.includes(u.id)} onChange={(e) => {
                              const id = e.target.value;
                              setSelectedUserIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
                            }} />
                            <span className="text-sm">{u.name} • {u.email}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="border p-2 rounded">
                      <div className="text-sm font-medium mb-2">Select Organizations</div>
                      <div className="max-h-36 overflow-y-auto">
                        {orgProfiles.map(o => (
                          <label key={o.id} className="flex items-center space-x-2 p-1">
                            <input type="checkbox" value={o.id} checked={selectedOrgIds.includes(o.id)} onChange={(e) => {
                              const id = e.target.value;
                              setSelectedOrgIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
                            }} />
                            <span className="text-sm">{o.name} • {o.type}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* URL Input */}
          {(resourceType === 'link' || resourceType === 'video') && (
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
                URL *
              </label>
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder={`Enter ${resourceType} URL`}
                required
              />
            </div>
          )}

          {/* Content for Notes */}
          {resourceType === 'note' && (
            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
                Content *
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Enter note content"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <input
                type="text"
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="e.g., Training, Documentation"
              />
            </div>

            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as BaseResource['priority'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <input
              type="text"
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Enter tags separated by commas"
            />
            <p className="text-xs text-gray-500 mt-1">Separate multiple tags with commas</p>
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
              Message to Recipient
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Optional message to include with the resource"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="notify"
              checked={notifyRecipient}
              onChange={(e) => setNotifyRecipient(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="notify" className="text-sm text-gray-700">
              Send notification to recipient
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end space-x-3">
          {isModal && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={isLoading}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading || !selectedProfileId}
            className="flex items-center space-x-2 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>Send Resource</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="max-h-[90vh] overflow-y-auto">
          {content_component}
        </div>
      </div>
    );
  }

  return content_component;
};

export default ResourceSender;