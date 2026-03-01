import { useState, useEffect, useRef } from 'react';
import { X, Search, Loader2, Download, ExternalLink } from 'lucide-react';
import { stock } from '../api';

export default function StockPhotoModal({ isOpen, onClose, onSelect }) {
    const [query, setQuery] = useState('');
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalResults, setTotalResults] = useState(0);
    const searchTimeout = useRef(null);

    useEffect(() => {
        if (isOpen && photos.length === 0) {
            handleSearch('nature'); // Default search
        }
    }, [isOpen]);

    const handleSearch = async (searchTerm, isNewSearch = true) => {
        if (!searchTerm.trim()) return;
        setLoading(true);
        try {
            const currentPage = isNewSearch ? 1 : page + 1;
            const res = await stock.search(searchTerm, currentPage);

            if (isNewSearch) {
                setPhotos(res.data.photos);
            } else {
                setPhotos(prev => [...prev, ...res.data.photos]);
            }

            setPage(currentPage);
            setTotalResults(res.data.total_results);
        } catch (err) {
            console.error("Stock search failed", err);
        } finally {
            setLoading(false);
        }
    };

    const onQueryChange = (e) => {
        const val = e.target.value;
        setQuery(val);

        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            handleSearch(val);
        }, 500);
    };

    if (!isOpen) return null;

    return (
        <div className="tw-modal-overlay" onClick={onClose}>
            <div className="tw-stock-modal" onClick={e => e.stopPropagation()}>
                <div className="tw-modal-header">
                    <div className="tw-header-title">
                        <h2>Stock Photos</h2>
                        <span className="tw-powered-by">Powered by Pexels</span>
                    </div>
                    <button className="tw-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="tw-modal-search">
                    <Search className="tw-search-icon" size={18} />
                    <input
                        type="text"
                        placeholder="Search high-quality photos..."
                        value={query}
                        onChange={onQueryChange}
                        autoFocus
                    />
                </div>

                <div className="tw-stock-modal-content">
                    {loading && photos.length === 0 ? (
                        <div className="tw-loading-state">
                            <Loader2 className="tw-spin" size={32} />
                            <span>Finding images...</span>
                        </div>
                    ) : photos.length === 0 ? (
                        <div className="tw-empty-state">
                            <span>No photos found for "{query}"</span>
                        </div>
                    ) : (
                        <div className="tw-image-grid">
                            {photos.map(photo => (
                                <div key={photo.id} className="tw-image-item" onClick={() => onSelect(photo)}>
                                    <img src={photo.src.medium} alt={photo.alt} loading="lazy" />
                                    <div className="tw-image-overlay">
                                        <span className="tw-photographer">{photo.photographer}</span>
                                        <button className="tw-add-btn">
                                            <Download size={14} />
                                            Add to Board
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {photos.length > 0 && photos.length < totalResults && (
                        <button
                            className="tw-load-more"
                            onClick={() => handleSearch(query, false)}
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="tw-spin" size={16} /> : 'Load More'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
