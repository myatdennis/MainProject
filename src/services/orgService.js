import apiRequest from '../utils/apiClient';
const seedOrgs = () => ([
    {
        id: '1',
        name: 'Pacific Coast University',
        type: 'University',
        contactPerson: 'Dr. Sarah Chen',
        contactEmail: 'sarah.chen@pacificcoast.edu',
        enrollmentDate: '2025-01-15',
        status: 'active',
        totalLearners: 45,
        activeLearners: 42,
        completionRate: 94,
        cohorts: ['Spring 2025 Leadership', 'Faculty Development 2025'],
        subscription: 'Premium',
        lastActivity: '2025-03-11',
        modules: { foundations: 98, bias: 91, empathy: 87, conversations: 82, planning: 76 },
        notes: 'Excellent engagement. Requested additional modules for faculty.'
    },
    {
        id: '2',
        name: 'Mountain View High School',
        type: 'K-12 Education',
        contactPerson: 'Marcus Rodriguez',
        contactEmail: 'mrodriguez@mvhs.edu',
        enrollmentDate: '2025-01-20',
        status: 'active',
        totalLearners: 23,
        activeLearners: 20,
        completionRate: 87,
        cohorts: ['Spring 2025 Leadership'],
        subscription: 'Standard',
        lastActivity: '2025-03-10',
        modules: { foundations: 95, bias: 89, empathy: 85, conversations: 78, planning: 65 },
        notes: 'Focus on athletic department leadership development.'
    },
    {
        id: '3',
        name: 'Community Impact Network',
        type: 'Nonprofit',
        contactPerson: 'Jennifer Walsh',
        contactEmail: 'jwalsh@communityimpact.org',
        enrollmentDate: '2025-01-10',
        status: 'inactive',
        totalLearners: 28,
        activeLearners: 15,
        completionRate: 61,
        cohorts: ['Spring 2025 Leadership'],
        subscription: 'Standard',
        lastActivity: '2025-02-28',
        modules: { foundations: 85, bias: 68, empathy: 54, conversations: 42, planning: 28 },
        notes: 'Low engagement recently. Follow up needed.'
    },
    {
        id: '4',
        name: 'Regional Fire Department',
        type: 'Government',
        contactPerson: 'Captain David Thompson',
        contactEmail: 'dthompson@regionalfire.gov',
        enrollmentDate: '2024-12-01',
        status: 'active',
        totalLearners: 67,
        activeLearners: 63,
        completionRate: 89,
        cohorts: ['Winter 2025 Leadership', 'Command Staff Development'],
        subscription: 'Premium',
        lastActivity: '2025-03-11',
        modules: { foundations: 92, bias: 88, empathy: 91, conversations: 85, planning: 79 },
        notes: 'Strong leadership commitment. Excellent results.'
    },
    {
        id: '5',
        name: 'TechForward Solutions',
        type: 'Corporate',
        contactPerson: 'Lisa Park',
        contactEmail: 'lpark@techforward.com',
        enrollmentDate: '2025-02-01',
        status: 'active',
        totalLearners: 34,
        activeLearners: 32,
        completionRate: 96,
        cohorts: ['Spring 2025 Leadership'],
        subscription: 'Premium',
        lastActivity: '2025-03-11',
        modules: { foundations: 100, bias: 97, empathy: 94, conversations: 91, planning: 88 },
        notes: 'Outstanding engagement. Interested in advanced modules.'
    }
]);
const mapOrgRecord = (record) => ({
    id: record.id,
    name: record.name,
    type: record.type,
    description: record.description ?? undefined,
    logo: record.logo ?? undefined,
    contactPerson: record.contact_person ?? '',
    contactEmail: record.contact_email,
    contactPhone: record.contact_phone ?? undefined,
    website: record.website ?? undefined,
    address: record.address ?? undefined,
    city: record.city ?? undefined,
    state: record.state ?? undefined,
    country: record.country ?? undefined,
    postalCode: record.postal_code ?? undefined,
    subscription: record.subscription,
    billingEmail: record.billing_email ?? undefined,
    billingCycle: record.billing_cycle ?? undefined,
    customPricing: record.custom_pricing ?? undefined,
    maxLearners: record.max_learners ?? undefined,
    maxCourses: record.max_courses ?? undefined,
    maxStorage: record.max_storage ?? undefined,
    features: record.features ?? {},
    settings: record.settings ?? {},
    status: record.status,
    enrollmentDate: record.enrollment_date ?? undefined,
    contractStart: record.contract_start ?? undefined,
    contractEnd: record.contract_end ?? undefined,
    createdAt: record.created_at ?? undefined,
    updatedAt: record.updated_at ?? undefined,
    totalLearners: record.total_learners ?? 0,
    activeLearners: record.active_learners ?? 0,
    completionRate: Number(record.completion_rate ?? 0),
    cohorts: record.cohorts ?? [],
    lastActivity: record.last_activity ?? undefined,
    modules: record.modules ?? {},
    notes: record.notes ?? undefined,
    tags: record.tags ?? []
});
const mapMemberRecord = (record) => ({
    id: record.id,
    orgId: record.org_id ?? record.orgId,
    userId: record.user_id ?? record.userId,
    role: record.role ?? 'member',
    invitedBy: record.invited_by ?? null,
    createdAt: record.created_at ?? new Date().toISOString(),
    updatedAt: record.updated_at ?? new Date().toISOString()
});
export const listOrgs = async () => {
    const json = await apiRequest('/api/admin/organizations');
    if ((json.data?.length ?? 0) === 0) {
        for (const org of seedOrgs()) {
            await createOrg(org);
        }
        const refreshed = await apiRequest('/api/admin/organizations');
        return (refreshed.data || []).map(mapOrgRecord);
    }
    return (json.data || []).map(mapOrgRecord);
};
export const getOrg = async (id) => {
    const json = await apiRequest('/api/admin/organizations');
    const record = (json.data || []).find(org => org.id === id);
    return record ? mapOrgRecord(record) : null;
};
export const createOrg = async (payload) => {
    const json = await apiRequest('/api/admin/organizations', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    return mapOrgRecord(json.data);
};
export const updateOrg = async (id, patch) => {
    const json = await apiRequest(`/api/admin/organizations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(patch)
    });
    return mapOrgRecord(json.data);
};
export const deleteOrg = async (id) => {
    await apiRequest(`/api/admin/organizations/${id}`, { method: 'DELETE' });
};
export const bulkUpdateOrgs = async (updates) => {
    const results = [];
    for (const update of updates) {
        const org = await updateOrg(update.id, update.data);
        results.push(org);
    }
    return results;
};
export const getOrgStats = async (id) => {
    const org = await getOrg(id);
    if (!org)
        return null;
    return {
        overview: {
            totalUsers: org.totalLearners,
            activeUsers: org.activeLearners,
            completionRate: org.completionRate,
            avgSessionTime: Math.floor(Math.random() * 30) + 15
        },
        engagement: {
            dailyActiveUsers: Math.floor(org.activeLearners * 0.6),
            weeklyActiveUsers: Math.floor(org.activeLearners * 0.8),
            monthlyActiveUsers: org.activeLearners
        },
        performance: {
            coursesCompleted: Object.values(org.modules).reduce((sum, val) => sum + Math.floor(val * 0.8), 0),
            certificatesIssued: Math.floor(org.totalLearners * (org.completionRate / 100)),
            avgScores: Object.fromEntries(Object.keys(org.modules).map(key => [key, Math.floor(Math.random() * 30) + 70]))
        },
        trends: {
            userGrowth: Array.from({ length: 12 }, (_, i) => ({
                month: new Date(Date.now() - (11 - i) * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7),
                users: Math.floor(Math.random() * 10) + org.totalLearners * 0.8
            })),
            completionTrends: Array.from({ length: 30 }, (_, i) => ({
                date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                completions: Math.floor(Math.random() * 5) + 2
            }))
        }
    };
};
export const listOrgMembers = async (orgId) => {
    const json = await apiRequest(`/api/admin/organizations/${orgId}/members`);
    return (json.data ?? []).map(mapMemberRecord);
};
export const addOrgMember = async (orgId, payload) => {
    const json = await apiRequest(`/api/admin/organizations/${orgId}/members`, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    return mapMemberRecord(json.data);
};
export const removeOrgMember = async (orgId, membershipId) => {
    await apiRequest(`/api/admin/organizations/${orgId}/members/${membershipId}`, {
        method: 'DELETE',
        expectedStatus: [200, 204],
        rawResponse: true
    });
};
export default {
    listOrgs,
    getOrg,
    updateOrg,
    createOrg,
    deleteOrg,
    bulkUpdateOrgs,
    getOrgStats,
    listOrgMembers,
    addOrgMember,
    removeOrgMember
};
