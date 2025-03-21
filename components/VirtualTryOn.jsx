// ✅ Updated VirtualTryOn.jsx with Full Async Workflow & Polling

import React, { useState, useEffect } from "react";
import axios from "axios";

const VirtualTryOn = () => {
  const [userImage, setUserImage] = useState(null);
  const [apparelImage, setApparelImage] = useState(null);
  const [userImagePreview, setUserImagePreview] = useState(null);
  const [apparelImagePreview, setApparelImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resultImageUrl, setResultImageUrl] = useState(null);
  const [error, setError] = useState(null);
  const [matchingAnalysis, setMatchingAnalysis] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [polling, setPolling] = useState(false);
  const [pollIntervalId, setPollIntervalId] = useState(null);

  const API_BASE_URL = "https://76e5op5rg6.execute-api.ap-southeast-2.amazonaws.com/dev";

  const handleUserImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUserImage(file);
      setUserImagePreview(URL.createObjectURL(file));
    }
  };

  const handleApparelImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setApparelImage(file);
      setApparelImagePreview(URL.createObjectURL(file));
    }
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = (error) => reject(error);
    });

  const uploadImageToS3 = async (imageFile, endpoint) => {
    const base64 = await toBase64(imageFile);
    const contentType = imageFile.type;
    const fileName = imageFile.name;

    const response = await axios.post(endpoint, {
      fileName,
      fileDataBase64: base64,
      contentType,
    });

    return response.data?.imageUrl;
  };

  const pollTryonStatus = (taskId) => {
    const API_STATUS_URL = `https://n1zcjhjanl.execute-api.ap-southeast-2.amazonaws.com/dev/process-tryon-result`;

    const intervalId = setInterval(async () => {
      try {
        const response = await axios.get(`${API_STATUS_URL}?taskId=${taskId}`);
        if (response.data.status === "succeed") {
          clearInterval(intervalId);
          setPollIntervalId(null);
          setPolling(false);
          setResultImageUrl(response.data.generatedImageUrl);
          window.generatedImageUrl = response.data.generatedImageUrl;
        } else if (response.data.status === "not_found") {
          console.log("Status not yet available. Still waiting...");
        } else {
          console.log("Still processing...");
        }
      } catch (err) {
        console.error("Polling error:", err);
        setError("Error checking try-on status.");
        clearInterval(intervalId);
        setPolling(false);
      }
    }, 5000);

    setPollIntervalId(intervalId);
    setPolling(true);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!userImage || !apparelImage) {
      setError("Please upload both user and apparel images.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResultImageUrl(null);
      setMatchingAnalysis(null);

      const userImageUrl = await uploadImageToS3(
        userImage,
        `${API_BASE_URL}/upload-user-image`
      );
      const apparelImageUrl = await uploadImageToS3(
        apparelImage,
        `${API_BASE_URL}/upload-apparel-image`
      );

      const tryonResponse = await axios.post(`https://ipgyftqcsg.execute-api.ap-southeast-2.amazonaws.com/dev/tryon-image`, {
        person_image_url: userImageUrl,
        garment_image_url: apparelImageUrl,
      });

      if (tryonResponse?.data?.taskId) {
        setTaskId(tryonResponse.data.taskId);
        pollTryonStatus(tryonResponse.data.taskId);
      } else {
        setError("Failed to initiate try-on job.");
      }
    } catch (err) {
      console.error("Error submitting try-on task:", err);
      setError(err.response?.data?.error || "An error occurred during virtual try-on.");
    } finally {
      setLoading(false);
    }
  };

  const handleMatchingAnalysis = async () => {
    if (!window.generatedImageUrl) {
      setError("Missing generated try-on image.");
      return;
    }

    try {
      setLoading(true);
      setMatchingAnalysis(null);
      setError(null);

      const response = await axios.post(`https://j1sp2omtq2.execute-api.ap-southeast-2.amazonaws.com/dev/MatchingAnalyzer`, {
        generated_image_url: window.generatedImageUrl,
        apparel_image_url: apparelImagePreview,
      });

      if (response.data?.matching_analysis) {
        setMatchingAnalysis(response.data.matching_analysis);
      } else {
        setError("Matching Analysis failed.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Matching Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pollIntervalId) clearInterval(pollIntervalId);
    };
  }, [pollIntervalId]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center font-sans">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white">Virtual Try-On</h1>
        <p className="text-white mt-2">Experience the perfect fit.</p>
      </header>

      <div className="bg-[#1a1a2f] w-full max-w-4xl rounded-lg shadow-md p-8 space-y-6">
        <h2 className="text-2xl font-medium text-white text-center mb-4">
          Step 1: Upload Your Photos
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-lg p-6 text-center">
            <h3 className="text-lg font-medium text-white mb-4">Your Photo</h3>
            <input type="file" accept="image/*" onChange={handleUserImageChange} className="hidden" id="userPhoto" />
            <label htmlFor="userPhoto" className="cursor-pointer">
              {userImagePreview ? (
                <img src={userImagePreview} alt="User Preview" className="mx-auto max-h-48 object-contain rounded-lg" />
              ) : (
                <div className="flex flex-col items-center justify-center h-48">
                  <p className="text-white">Click to upload</p>
                </div>
              )}
            </label>
          </div>

          <div className="border border-gray-200 rounded-lg p-6 text-center">
            <h3 className="text-lg font-medium text-white mb-4">Clothing Item</h3>
            <input type="file" accept="image/*" onChange={handleApparelImageChange} className="hidden" id="apparelPhoto" />
            <label htmlFor="apparelPhoto" className="cursor-pointer">
              {apparelImagePreview ? (
                <img src={apparelImagePreview} alt="Apparel Preview" className="mx-auto max-h-48 object-contain rounded-lg" />
              ) : (
                <div className="flex flex-col items-center justify-center h-48">
                  <p className="text-white">Click to upload</p>
                </div>
              )}
            </label>
          </div>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={handleSubmit}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            Generate Try-On Result
          </button>
        </div>

        {polling && !resultImageUrl && (
          <p className="text-yellow-500 text-center mt-4">Waiting for result... polling server.</p>
        )}

        {loading && <p className="text-gray-400 text-center animate-pulse">Processing...</p>}
        {error && <p className="text-red-500 text-center">{error}</p>}
      </div>

      {resultImageUrl && (
        <div className="mt-8 w-full max-w-4xl bg-white rounded-lg shadow-md p-8 space-y-6">
          <h2 className="text-2xl font-medium text-gray-800 text-center">Step 2: Try-On Result</h2>
          <img src={resultImageUrl} alt="Try-On Result" className="rounded-lg shadow-md mx-auto max-h-96 object-contain" />
          <div className="text-center">
            <button
              type="button"
              onClick={handleMatchingAnalysis}
              className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 mt-4"
            >
              Analyze Fit
            </button>
          </div>
        </div>
      )}

      {matchingAnalysis && (
        <div className="mt-6 w-full max-w-4xl bg-gray-50 rounded-lg p-6 text-center">
          <h3 className="font-semibold text-gray-800">Fit Analysis</h3>
          <p className="text-lg text-gray-600">{matchingAnalysis}</p>
        </div>
      )}
    </div>
  );
};

export default VirtualTryOn;
