import React, { useState, useEffect } from "react";
import axios from "axios";
import { Users, UserPlus, Shield, X, Save, Trash2, CheckSquare, Square } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SubUsersManagerProps {
  serverId: string;
  embedded?: boolean;
}

const ALL_PERMISSIONS = [
  { id: "start", label: "Start Server", group: "Power" },
  { id: "stop", label: "Stop Server", group: "Power" },
  { id: "restart", label: "Restart Server", group: "Power" },
  { id: "files", label: "File Management", group: "Management" },
  { id: "plugins", label: "Plugins Management", group: "Management" },
  { id: "mods", label: "Mods Management", group: "Management" },
  { id: "settings", label: "Server Settings", group: "Configuration" },
  { id: "properties", label: "Server Properties", group: "Configuration" },
  { id: "backup", label: "Backup Management", group: "Management" }
];

export default function SubUsersManager({ serverId, embedded = false }: SubUsersManagerProps) {
  const [subUsers, setSubUsers] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  
  useEffect(() => {
    fetchData();
  }, [serverId]);

  const fetchData = async () => {
    try {
      const res = await axios.get(`/api/servers/${serverId}/subusers`);
      setSubUsers(res.data.subUsers || []);
      setAvailableUsers(res.data.availableUsers || []);
    } catch (e) {
      console.error("Failed to fetch subusers", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedUser && !editingUser) return;
    
    const userId = editingUser ? editingUser.userId : selectedUser;
    
    try {
      await axios.post(`/api/servers/${serverId}/subusers`, {
        userId,
        permissions: selectedPermissions
      });
      setShowAddModal(false);
      setEditingUser(null);
      setSelectedUser("");
      setSelectedPermissions([]);
      fetchData();
    } catch (e) {
      console.error("Failed to save subuser", e);
    }
  };

  const handleDelete = async (userId: string) => {
    setDeleteUserId(null);
    try {
      await axios.delete(`/api/servers/${serverId}/subusers/${userId}`);
      fetchData();
    } catch (e) {
      console.error("Failed to delete subuser", e);
    }
  };

  const togglePermission = (permId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permId) 
        ? prev.filter(p => p !== permId)
        : [...prev, permId]
    );
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${embedded ? 'py-8' : 'flex-1 min-h-[200px]'}`}>
        <div className="w-7 h-7 border-2 border-theme-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const getUsername = (userId: string) => {
    const u = availableUsers.find(u => u.id === userId);
    return u ? u.username : userId;
  };

  // Filter out users that are already sub-users
  const unassignedUsers = availableUsers.filter(u => !subUsers.some(su => su.userId === u.id));

  const content = (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
        <div>
          <h3 className="text-theme-500 font-bold flex items-center gap-2 text-base md:text-lg">
            <Users className="w-5 h-5 text-theme-500" /> Sub-Users Access Control
          </h3>
          <p className="text-muted-foreground text-xs md:text-sm mt-0.5">
            Grant permissions to other users to manage and access this server.
          </p>
        </div>
        <button 
          onClick={() => {
            setEditingUser(null);
            setSelectedUser(unassignedUsers[0]?.id || "");
            setSelectedPermissions([]);
            setShowAddModal(true);
          }}
          className="flex items-center space-x-2 px-3.5 py-2 bg-theme-600 hover:bg-theme-500 text-white text-xs md:text-sm font-semibold rounded-xl transition-all shadow-md shadow-theme-600/20 active:scale-95 shrink-0"
        >
          <UserPlus size={16} />
          <span>Add Sub-User</span>
        </button>
      </div>

      {subUsers.length === 0 ? (
        <div className="bg-muted/40 border border-border rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-theme-500/10 rounded-2xl flex items-center justify-center mb-3 border border-theme-500/20">
            <Users size={24} className="text-theme-400" />
          </div>
          <h4 className="text-sm md:text-base font-bold text-foreground mb-1">No Sub-Users Assigned</h4>
          <p className="text-muted-foreground max-w-sm text-xs">
            You haven't granted access to any other users for this server yet. Click "Add Sub-User" to delegate permissions.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {subUsers.map((su) => (
            <div key={su.userId} className="bg-card/70 border border-border hover:border-theme-500/30 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 bg-theme-500/10 rounded-xl flex items-center justify-center border border-theme-500/20 shrink-0">
                  <Shield className="text-theme-400" size={20} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-foreground font-semibold text-sm truncate">{getUsername(su.userId)}</h4>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className="text-xs text-muted-foreground">{su.permissions.length} permissions</span>
                    <span className="text-muted-foreground/40">•</span>
                    <span className="text-[11px] font-mono text-theme-400 bg-theme-500/10 px-1.5 py-0.5 rounded border border-theme-500/20">
                      {su.permissions.slice(0, 3).join(", ")}{su.permissions.length > 3 ? ` +${su.permissions.length - 3} more` : ""}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                <button 
                  onClick={() => {
                    setEditingUser(su);
                    setSelectedPermissions(su.permissions);
                    setShowAddModal(true);
                  }}
                  className="px-3 py-1.5 bg-muted hover:bg-muted-hover text-foreground rounded-lg transition-colors text-xs font-medium border border-border"
                >
                  Edit Permissions
                </button>
                {deleteUserId === su.userId ? (
                  <div className="flex items-center gap-1 bg-theme-500/10 border border-theme-500/30 px-2 py-1 rounded-lg text-xs">
                    <span className="text-theme-400 font-medium">Remove?</span>
                    <button
                      onClick={() => handleDelete(su.userId)}
                      className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-2 py-0.5 rounded text-xs transition-all active:scale-95"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setDeleteUserId(null)}
                      className="bg-muted hover:bg-muted-hover text-muted-foreground px-2 py-0.5 rounded text-xs transition-all"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setDeleteUserId(su.userId)}
                    className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors border border-rose-500/20"
                    title="Remove User"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <>
      {embedded ? (
        <div className="bg-black/40 dark:bg-black/40 backdrop-blur-xl border border-border p-6 md:p-8 rounded-3xl shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] ring-1 ring-border-subtle relative z-20 group hover:bg-black/60 transition-colors mb-8">
          {content}
        </div>
      ) : (
        <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto custom-scrollbar relative">
          <div className="max-w-4xl w-full mx-auto pb-24">
            {content}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#121214] border border-border shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-5 border-b border-border-subtle bg-muted shrink-0">
                <h3 className="text-lg font-bold text-foreground">
                  {editingUser ? `Edit Permissions for ${getUsername(editingUser.userId)}` : "Add Sub-User"}
                </h3>
                <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
                {!editingUser && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Select User</label>
                    <select 
                      value={selectedUser} 
                      onChange={(e) => setSelectedUser(e.target.value)}
                      className="w-full bg-black/40 dark:bg-black/40 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-theme-600/50 transition-colors"
                    >
                      <option value="" disabled>Choose a user...</option>
                      {unassignedUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.username}</option>
                      ))}
                    </select>
                    {unassignedUsers.length === 0 && (
                      <p className="text-xs text-theme-400 mt-2">No available users to add.</p>
                    )}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-muted-foreground">Permissions</label>
                    <button 
                      onClick={() => setSelectedPermissions(ALL_PERMISSIONS.map(p => p.id))}
                      className="text-xs text-theme-500 hover:text-theme-300 font-medium"
                    >
                      Select All
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {ALL_PERMISSIONS.map(perm => {
                      const isSelected = selectedPermissions.includes(perm.id);
                      return (
                        <div 
                          key={perm.id} 
                          onClick={() => togglePermission(perm.id)}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected ? 'bg-theme-600/10 border-theme-600/30' : 'bg-muted border-border-subtle hover:bg-black/40 dark:bg-black/40 hover:border-border'
                          }`}
                        >
                          <div>
                            <div className={`font-medium ${isSelected ? 'text-theme-300' : 'text-foreground-muted'}`}>
                              {perm.label}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">{perm.group}</div>
                          </div>
                          {isSelected ? (
                            <CheckSquare className="text-theme-500" size={20} />
                          ) : (
                            <Square className="text-muted-foreground" size={20} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-border-subtle bg-muted flex justify-end space-x-3 shrink-0">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-muted hover:bg-muted-hover text-foreground font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={(!editingUser && !selectedUser) || selectedPermissions.length === 0}
                  className="px-4 py-2 bg-theme-600 hover:bg-theme-700 text-foreground font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Save size={18} />
                  <span>Save</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
