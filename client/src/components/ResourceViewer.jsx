import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  Video,
  Image as ImageIcon,
  Link2,
  FileCode,
  FileSpreadsheet,
  FileCheck2
} from 'lucide-react';

const ResourceViewer = ({ resource, onClose }) => {
  if (!resource) return null;

  const [textContent, setTextContent] = useState('');
  const [loadingText, setLoadingText] = useState(false);

  const BACKEND_URL = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
    : 'http://localhost:5002';

  const getFileUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const cleanPath = path.replace(/\\/g, '/');
    const filename = cleanPath.split('/').pop();
    return `${BACKEND_URL}/uploads/resources/${filename}`;
  };

  const fileUrl = getFileUrl(resource.filePath);

  const isLink = resource.type === 'link';
  const isVideo = resource.type === 'video';
  const isImage = resource.type === 'image';
  const isPdf = resource.type === 'pdf';
  const isText = resource.type === 'text';

  // If text file, try fetching it to render inside the viewer directly
  useEffect(() => {
    if (isText && fileUrl) {
      setLoadingText(true);
      fetch(fileUrl)
        .then((res) => res.text())
        .then((txt) => {
          setTextContent(txt);
          setLoadingText(false);
        })
        .catch(() => {
          setLoadingText(false);
        });
    }
  }, [isText, fileUrl]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3 min-w-0">
            {isVideo && <Video className="w-5 h-5 text-indigo-600 flex-shrink-0" />}
            {isImage && <ImageIcon className="w-5 h-5 text-emerald-600 flex-shrink-0" />}
            {isPdf && <FileText className="w-5 h-5 text-red-600 flex-shrink-0" />}
            {isText && <FileCode className="w-5 h-5 text-amber-600 flex-shrink-0" />}
            {isLink && <Link2 className="w-5 h-5 text-blue-600 flex-shrink-0" />}
            {!isVideo && !isImage && !isPdf && !isText && !isLink && (
              <FileSpreadsheet className="w-5 h-5 text-slate-600 flex-shrink-0" />
            )}

            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {resource.title}
              </h3>
              <p className="text-[11px] text-slate-500 uppercase font-mono mt-0.5">
                {resource.type} {resource.fileName ? `• ${resource.fileName}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isLink && fileUrl && (
              <a
                href={fileUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded transition-colors"
                title="Download Resource"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-200 transition-colors"
              title="Close viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Description if present */}
        {resource.description && (
          <div className="px-5 py-2.5 bg-slate-100/60 border-b border-slate-200 text-xs text-slate-600">
            {resource.description}
          </div>
        )}

        {/* Content Viewer Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex items-center justify-center bg-slate-950/5 min-h-[300px]">
          {/* 1. Video Player */}
          {isVideo && (
            <div className="w-full flex justify-center bg-black rounded overflow-hidden shadow-inner">
              <video
                controls
                controlsList="nodownload"
                className="w-full max-h-[65vh] rounded"
                src={fileUrl}
              >
                Your browser does not support HTML5 video streaming.
              </video>
            </div>
          )}

          {/* 2. Image Viewer */}
          {isImage && (
            <div className="w-full flex justify-center">
              <img
                src={fileUrl}
                alt={resource.title}
                className="max-h-[65vh] max-w-full object-contain rounded shadow-sm border border-slate-200"
              />
            </div>
          )}

          {/* 3. PDF Viewer */}
          {isPdf && (
            <div className="w-full h-[65vh] flex flex-col items-center justify-center bg-white rounded border border-slate-200 p-4 space-y-4">
              <iframe
                src={`${fileUrl}#toolbar=1`}
                title={resource.title}
                className="w-full h-full rounded border-0 hidden sm:block"
              />
              <div className="sm:hidden text-center space-y-3">
                <FileText className="w-12 h-12 text-red-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-800">PDF Document</p>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded text-xs font-semibold"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open in Browser</span>
                </a>
              </div>
            </div>
          )}

          {/* 4. Text Viewer */}
          {isText && (
            <div className="w-full bg-white rounded border border-slate-200 p-4 font-mono text-xs text-slate-800 max-h-[60vh] overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-sm">
              {loadingText ? (
                <p className="text-slate-400 italic">Loading text content...</p>
              ) : (
                textContent || 'No readable text content found in file.'
              )}
            </div>
          )}

          {/* 5. External Link */}
          {isLink && (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center space-y-4 max-w-md shadow-sm">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Link2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">{resource.title}</h4>
                <p className="text-xs text-slate-500 mt-1 break-all">{resource.externalUrl}</p>
              </div>
              <a
                href={resource.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors"
              >
                <span>Open Resource in New Tab</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

          {/* 6. Document / Presentation / Downloadable */}
          {!isVideo && !isImage && !isPdf && !isText && !isLink && (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center space-y-4 max-w-md shadow-sm">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">{resource.title}</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Format: <span className="uppercase font-mono font-semibold">{resource.type}</span>
                </p>
              </div>
              <a
                href={fileUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download File</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResourceViewer;
