import React, { useState, useRef, useCallback } from 'react';
import { DeviceType } from './types';
import { generateScreenshotImage, updateScreenshotImage } from './services/geminiService';

// --- ICONS ---
const UploadIcon = () => (
    <svg className="w-12 h-12 mx-auto text-red-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
         <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4C9.11 4 6.6 5.64 5.35 8.04C2.34 8.36 0 10.91 0 14C0 17.31 2.69 20 6 20H19C21.76 20 24 17.76 24 15C24 12.36 21.95 10.22 19.35 10.04ZM14 13V17H10V13H7L12 8L17 13H14Z" fill="currentColor"/>
    </svg>
);

const PlusIcon = () => (
    <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-500 transition-colors" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
    </svg>
);

const DownloadIcon = () => (
    <svg className="w-6 h-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const LoadingSpinner = () => (
    <svg className="animate-spin h-8 w-8 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const ButtonLoadingSpinner = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

// --- MAIN APP ---
export default function App() {
    const [viewMode, setViewMode] = useState<'upload' | 'preview'>('upload');
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [generatedScreenshots, setGeneratedScreenshots] = useState<string[]>([]);
    const [deviceType, setDeviceType] = useState<DeviceType>(DeviceType.Iphone);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [isUpdating, setIsUpdating] = useState<{[key: number]: boolean}>({});
    const [isDragging, setIsDragging] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
    const [changeDescription, setChangeDescription] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFiles = useCallback((files: FileList | null) => {
        if (!files) return;
        const newFiles = Array.from(files)
            .filter(file => file.type.startsWith('image/'))
            .slice(0, 3 - uploadedFiles.length);

        if (newFiles.length > 0) {
            setUploadedFiles(prev => [...prev, ...newFiles]);
        }
    }, [uploadedFiles.length]);

    const handleDelete = useCallback((indexToDelete: number) => {
        setUploadedFiles(prev => prev.filter((_, index) => index !== indexToDelete));
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFiles(e.target.files);
        if (e.target) e.target.value = '';
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    const triggerFileSelect = () => fileInputRef.current?.click();
    
    const handleStartOver = () => {
        setUploadedFiles([]);
        setGeneratedScreenshots([]);
        setChangeDescription('');
        setSelectedImageIndex(null);
        setIsUpdating({});
        setViewMode('upload');
    };
    
    const handleGenerate = async () => {
        if (uploadedFiles.length === 0) return;
        
        setViewMode('preview');
        setIsGenerating(true);
        setGeneratedScreenshots([]);
        setSelectedImageIndex(0);

        const fileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        try {
            const dataUrls = await Promise.all(uploadedFiles.map(fileToDataUrl));
            const results = await Promise.all(
                dataUrls.map(dataUrl => generateScreenshotImage(dataUrl, deviceType))
            );
            setGeneratedScreenshots(results);
        } catch (error) {
            console.error(error);
            alert('Failed to generate screenshots. Please try again.');
            handleStartOver(); // Go back to upload on failure
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleUpdate = async () => {
        if (selectedImageIndex === null || !changeDescription.trim() || !generatedScreenshots[selectedImageIndex]) return;

        setIsUpdating(prev => ({ ...prev, [selectedImageIndex]: true }));
        try {
            const updatedImage = await updateScreenshotImage(generatedScreenshots[selectedImageIndex], changeDescription);
            setGeneratedScreenshots(prev => {
                const newScreenshots = [...prev];
                newScreenshots[selectedImageIndex] = updatedImage;
                return newScreenshots;
            });
            setChangeDescription('');
// FIX: Corrected catch block syntax. The `=>` is not valid here.
        } catch (error) {
            console.error(error);
            alert('Failed to update screenshot. Please try again.');
        } finally {
            setIsUpdating(prev => ({ ...prev, [selectedImageIndex]: false }));
        }
    };

    const handleDownload = (dataUrl: string, index: number) => {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `appshot-${index + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const activeStoreClasses = "border-red-500 text-red-600 bg-red-50";
    const inactiveStoreClasses = "border-gray-200 text-gray-500 bg-white hover:bg-gray-50";

    if (viewMode === 'upload') {
        return (
             <div className="min-h-screen bg-gradient-to-b from-white to-[#FFF7F5] flex flex-col items-center justify-center p-4 font-sans text-gray-800">
                <input ref={fileInputRef} id="screenshot-upload" type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFileChange} multiple />
                <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-2xl border border-gray-100 flex flex-col gap-6 animate-pop-in">
                     <header className="space-y-1 text-center">
                        <h1 className="text-3xl font-bold text-red-500 tracking-tight">AppShot</h1>
                        <p className="text-gray-500 text-sm">Create stunning app release screenshots with AI. Built for Google store and App Store.</p>
                    </header>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Generate for</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setDeviceType(DeviceType.Iphone)} className={`w-full py-2 text-sm font-semibold rounded-lg border transform transition-transform active:scale-95 ${deviceType === DeviceType.Iphone ? activeStoreClasses : inactiveStoreClasses}`}>App Store</button>
                            <button onClick={() => setDeviceType(DeviceType.Android)} className={`w-full py-2 text-sm font-semibold rounded-lg border transform transition-transform active:scale-95 ${deviceType === DeviceType.Android ? activeStoreClasses : inactiveStoreClasses}`}>Google Store</button>
                        </div>
                    </div>

                    <div className="space-y-2">
                         <h2 className="text-sm font-medium">Upload Thumbnail</h2>
                         <p className="text-xs text-gray-500">Please upload file in jpeg or png format and make sure the file size is under 25 MB.</p>
                         <div
                            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                            className={`relative border-2 border-dashed rounded-lg p-6 text-center transform transition-all duration-300 ${isDragging ? 'border-red-500 bg-red-50 scale-105' : 'border-gray-300'}`}
                         >
                             {uploadedFiles.length > 0 ? (
                                 <div className="space-y-2">
                                     {uploadedFiles.map((file, index) => (
                                         <div key={file.name + index} className="flex items-center justify-between bg-gray-100 p-2 rounded-md text-sm animate-fade-in-down">
                                             <span className="truncate">{file.name}</span>
                                             <button onClick={() => handleDelete(index)} className="ml-2 text-gray-500 hover:text-red-500 transition-colors text-xl font-bold leading-none">&times;</button>
                                         </div>
                                     ))}
                                     {uploadedFiles.length < 3 && (
                                         <div onClick={triggerFileSelect} className="group mt-2 flex flex-row items-center justify-center p-3 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:bg-gray-50 hover:border-gray-400 transition-colors transform active:scale-95">
                                            <PlusIcon />
                                            <p className="ml-2 text-sm font-semibold text-gray-600 group-hover:text-gray-700 transition-colors">Add more</p>
                                        </div>
                                     )}
                                 </div>
                             ) : (
                                <>
                                    <UploadIcon />
                                    <p className="text-sm mt-4 font-semibold">Drop file or browse</p>
                                    <p className="text-xs text-gray-400 mt-1">Format: .jpeg, .png & Max file size: 25 MB</p>
                                    <button onClick={triggerFileSelect} className="mt-4 bg-gray-800 text-white px-4 py-2 text-sm font-semibold rounded-lg hover:bg-gray-900 transition-colors transform active:scale-95">Browse Files</button>
                                </>
                             )}
                         </div>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={handleStartOver} className="w-full py-3 px-4 rounded-lg border border-gray-300 font-semibold text-sm hover:bg-gray-50 transition-all transform active:scale-95">Cancel</button>
                        <button onClick={handleGenerate} disabled={isGenerating || uploadedFiles.length === 0} className="w-full py-3 px-4 rounded-lg bg-red-500 text-white font-semibold text-sm hover:bg-red-600 disabled:bg-red-300 disabled:cursor-not-allowed flex items-center justify-center transition-all transform active:scale-95">
                            {isGenerating && <ButtonLoadingSpinner />}
                            Generate
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row h-screen bg-white font-sans text-gray-800">
            <aside className="w-full lg:w-[400px] bg-white p-6 lg:p-8 flex flex-col border-r border-gray-200">
                 <header className="space-y-1 mb-6">
                    <h1 className="text-3xl font-bold text-red-500 tracking-tight">AppShot</h1>
                    <p className="text-gray-500 text-sm">Create stunning app release screenshots with AI. Built for Google store and App Store.</p>
                </header>
                
                <div className="space-y-2 mb-6">
                    <label className="text-sm font-medium">Generate for</label>
                    <div className="grid grid-cols-2 gap-2">
                         <button onClick={() => setDeviceType(DeviceType.Iphone)} className={`w-full py-2 text-sm font-semibold rounded-lg border transform transition-transform active:scale-95 ${deviceType === DeviceType.Iphone ? activeStoreClasses : inactiveStoreClasses}`}>App Store</button>
                         <button onClick={() => setDeviceType(DeviceType.Android)} className={`w-full py-2 text-sm font-semibold rounded-lg border transform transition-transform active:scale-95 ${deviceType === DeviceType.Android ? activeStoreClasses : inactiveStoreClasses}`}>Google Store</button>
                    </div>
                </div>
                
                <div className="space-y-2 mb-6">
                    <h2 className="text-sm font-medium">Upload Thumbnail</h2>
                     <div className="space-y-2">
                         {uploadedFiles.map((file, index) => (
                             <div key={index} className="flex items-center justify-between bg-gray-100 p-2 rounded-md text-sm">
                                 <span className="truncate">{file.name}</span>
                             </div>
                         ))}
                     </div>
                </div>

                <button onClick={handleStartOver} className="w-full py-3 mb-6 px-4 rounded-lg border border-gray-300 font-semibold text-sm hover:bg-gray-50 transition-all transform active:scale-95">Start Over</button>

                <div className="mt-auto pt-6 border-t border-gray-200 space-y-3">
                    <textarea 
                        value={changeDescription}
                        onChange={(e) => setChangeDescription(e.target.value)}
                        placeholder={`Describe changes for image ${selectedImageIndex !== null ? selectedImageIndex + 1 : ''}...`}
                        disabled={selectedImageIndex === null || isUpdating[selectedImageIndex ?? -1]}
                        className="w-full p-3 h-24 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none disabled:bg-gray-100 transition-colors"
                    />
                    <button 
                        onClick={handleUpdate} 
                        disabled={selectedImageIndex === null || !changeDescription.trim() || isUpdating[selectedImageIndex ?? -1] || isGenerating}
                        className="w-full py-3 px-4 rounded-lg bg-red-500 text-white font-semibold text-sm hover:bg-red-600 disabled:bg-red-300 disabled:cursor-not-allowed flex items-center justify-center transition-all transform active:scale-95">
                        {isUpdating[selectedImageIndex ?? -1] && <ButtonLoadingSpinner />}
                        Update
                    </button>
                </div>
            </aside>

            <main className="flex-1 bg-gradient-to-b from-white to-[#FFF7F5] p-6 lg:p-8 flex flex-col overflow-hidden">
                <header className="mb-6 flex-shrink-0">
                    <h1 className="text-xl font-bold">Preview</h1>
                    <p className="text-gray-500 text-sm">Here's a preview of your screenshot changes. Describe any changes you want to make in the chat.</p>
                </header>

                <div className="flex-1 flex items-center overflow-x-auto overflow-y-hidden pt-2 pb-4 -mx-2 px-2">
                    <div className="flex h-full gap-6">
                        {Array.from({ length: uploadedFiles.length }).map((_, index) => {
                             const isLoading = isGenerating || isUpdating[index];
                             const generatedImage = generatedScreenshots[index];
                             const isSelected = selectedImageIndex === index;

                             return (
                                <div 
                                    key={index} 
                                    className={`group relative h-full aspect-[9/16] rounded-lg cursor-pointer overflow-hidden ring-offset-2 ring-offset-white ${isSelected ? 'ring-2 ring-red-500' : ''} flex-shrink-0 transform transition-all duration-300 hover:scale-[1.02]`}
                                    onClick={() => setSelectedImageIndex(index)}
                                >
                                    {generatedImage && <img src={generatedImage} alt={`generated-screenshot-${index}`} className="w-full h-full object-contain animate-fade-in"/>}
                                    
                                    {generatedImage && !isLoading && (
                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-3">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation(); 
                                                    handleDownload(generatedImage, index);
                                                }}
                                                className="p-2 rounded-full bg-black/50 hover:bg-black/75 transition-all transform hover:scale-110"
                                                aria-label="Download image"
                                            >
                                                <DownloadIcon />
                                            </button>
                                        </div>
                                    )}

                                    {isLoading && (
                                        <div className="absolute inset-0 w-full h-full bg-white/80 backdrop-blur-sm flex items-center justify-center">
                                            <LoadingSpinner />
                                        </div>
                                    )}
                                </div>
                             );
                        })}
                    </div>
                </div>
            </main>
        </div>
    );
}