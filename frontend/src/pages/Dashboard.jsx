import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, boards } from '../api';
import AdminInviteForm from '../components/AdminInviteForm';
import { Copy, Trash2, Edit2 } from 'lucide-react';

export default function Dashboard() {
    const [user, setUser] = useState(null);
    const [myBoards, setMyBoards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [editingBoardId, setEditingBoardId] = useState(null);
    const [editValue, setEditValue] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const userRes = await auth.me();
                setUser(userRes.data);

                const boardsRes = await boards.getAll();
                setMyBoards(boardsRes.data);
            } catch (err) {
                console.error("Failed to fetch dashboard data", err);
                navigate('/login');
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, [navigate]);

    const handleLogout = async () => {
        try {
            await auth.logout();
        } catch (e) {
            console.error(e);
        }
        localStorage.removeItem('token');
        navigate('/login');
    };

    const handleCreateBoard = async () => {
        setIsCreating(true);
        try {
            const title = `Untitled Board ${new Date().toLocaleDateString()}`;
            const res = await boards.create(title);
            navigate(`/board/${res.data.id}`);
        } catch (err) {
            console.error("Failed to create board", err);
            alert("Could not create board.");
            setIsCreating(false);
        }
    };

    const handleDuplicateBoard = async (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            const res = await boards.duplicate(id);
            setMyBoards(prev => [...prev, res.data]);
        } catch (err) {
            console.error("Failed to duplicate board", err);
            alert("Could not duplicate board.");
        }
    };

    const handleDeleteBoard = async (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        const board = myBoards.find(b => b.id === id);
        const isOwner = board && user && String(board.owner_id) === String(user.id);
        const message = isOwner
            ? "Are you sure you want to delete this board? This cannot be undone and will remove it for everyone."
            : "Are you sure you want to remove this board from your list? You will need to be re-invited to access it again.";

        if (!confirm(message)) return;
        try {
            await boards.delete(id);
            setMyBoards(prev => prev.filter(b => b.id !== id));
        } catch (err) {
            console.error("Failed to delete board", err);
            const errorMsg = err.response?.data?.detail || "Could not update board list.";
            alert(errorMsg);
        }
    };

    const handleRenameBoard = async (id, newTitle) => {
        if (!newTitle.trim() || newTitle === myBoards.find(b => b.id === id)?.title) {
            setEditingBoardId(null);
            return;
        }

        try {
            const res = await boards.update(id, { title: newTitle });
            setMyBoards(prev => prev.map(b => b.id === id ? res.data : b));
        } catch (err) {
            console.error("Failed to rename board", err);
        } finally {
            setEditingBoardId(null);
        }
    };

    const startEditing = (e, board) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingBoardId(board.id);
        setEditValue(board.title);
    };

    if (loading) {
        return <div className="tw-app"><div className="tw-loading">Loading Chalkboard...</div></div>;
    }

    return (
        <div className="tw-app dashboard-layout">
            <aside className="tw-sidebar">
                <div className="tw-sidebar-header">
                    <img src="/logo.png" alt="Chalkboard" className="tw-sidebar-logo" />

                </div>
                <nav className="tw-sidebar-nav">
                    <a href="#" className="active">Dashboard</a>
                </nav>
                <div className="tw-sidebar-footer">
                    <div className="tw-user-info">
                        <span className="tw-user-email">{user?.email}</span>
                        <span className="tw-user-role">{user?.role}</span>
                    </div>
                    <button onClick={handleLogout} className="tw-btn-outline">Logout</button>
                </div>
            </aside>

            <main className="tw-main-content">
                <header className="tw-topbar">
                    <h1>Dashboard</h1>
                </header>

                <div className="tw-content-area">
                    <div className="tw-welcome-banner">
                        <h2>Welcome back, {user?.display_name || user?.email.split('@')[0]}!</h2>
                        <p>Select a board from below to start collaborating, or create a new one.</p>
                        <button className="tw-btn" onClick={handleCreateBoard} disabled={isCreating}>
                            {isCreating ? 'Creating...' : '+ New Board'}
                        </button>
                    </div>

                    <div className="tw-boards-grid">
                        <h3>My Boards</h3>
                        {myBoards.length === 0 ? (
                            <p className="tw-empty-state">You haven't created any boards yet.</p>
                        ) : (
                            <div className="tw-grid">
                                {myBoards.map(board => (
                                    <div key={board.id} className="tw-board-card-wrapper">
                                        <Link to={`/board/${board.id}`} className="tw-board-card">
                                            <div className="tw-board-card-content">
                                                {editingBoardId === board.id ? (
                                                    <div className="tw-inline-edit" onClick={(e) => e.preventDefault()}>
                                                        <input
                                                            autoFocus
                                                            className="tw-rename-input"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleRenameBoard(board.id, editValue);
                                                                if (e.key === 'Escape') setEditingBoardId(null);
                                                            }}
                                                            onBlur={() => handleRenameBoard(board.id, editValue)}
                                                        />
                                                    </div>
                                                ) : (
                                                    <h4>{board.title}</h4>
                                                )}
                                                <span className="tw-date">Created: {new Date(board.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <div className="tw-board-card-actions">
                                                {String(board.owner_id) === String(user?.id) && (
                                                    <button className="icon-btn" onClick={(e) => startEditing(e, board)} title="Rename">
                                                        <Edit2 size={16} />
                                                    </button>
                                                )}
                                                <button className="icon-btn" onClick={(e) => handleDuplicateBoard(e, board.id)} title="Duplicate">
                                                    <Copy size={16} />
                                                </button>
                                                <button
                                                    className="icon-btn danger"
                                                    onClick={(e) => handleDeleteBoard(e, board.id)}
                                                    title={String(board.owner_id) === String(user?.id) ? "Delete Board" : "Remove Access"}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {user?.role === 'admin' && (
                        <div className="tw-admin-section" style={{ marginTop: '3rem' }}>
                            <AdminInviteForm />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
