import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import backend from '../api/backendClient';

export default function RequestHelpTab({ teacherId }) {
  const [topic, setTopic] = useState('');
  const [details, setDetails] = useState('');
  const queryClient = useQueryClient();

  // Fetch existing help requests
  const { data: requests } = useQuery(['help-requests'], () => backend.list('help_requests'));

  // Mutation to submit a new request
  const submitRequest = useMutation(
    (newRequest) => backend.post('help_requests', newRequest),
    { onSuccess: () => { queryClient.invalidateQueries(['help-requests']); alert('Request submitted!'); } }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    submitRequest.mutate({ teacher_id: teacherId, topic, details, status: 'Open' });
    setTopic('');
    setDetails('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <form onSubmit={handleSubmit} className="bg-white p-6 border rounded-lg shadow-sm">
        <h3 className="font-semibold text-lg mb-4">Submit New Request</h3>
        <input className="w-full p-2 mb-4 border rounded" placeholder="Topic (e.g., IT Support)" value={topic} onChange={(e) => setTopic(e.target.value)} required />
        <textarea className="w-full p-2 mb-4 border rounded" placeholder="Details" value={details} onChange={(e) => setDetails(e.target.value)} required />
        <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded">Submit Request</button>
      </form>

      <div className="bg-white p-6 border rounded-lg shadow-sm">
        <h3 className="font-semibold text-lg mb-4">My Requests</h3>
        <div className="space-y-3">
          {requests?.mysqlResult?.map(req => (
            <div key={req.id} className="p-3 border-b text-sm">
              <p className="font-bold">{req.topic}</p>
              <p className="text-slate-600">{req.details}</p>
              <span className="text-xs bg-slate-100 px-2 py-1 rounded">{req.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}