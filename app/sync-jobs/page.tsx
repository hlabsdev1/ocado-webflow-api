"use client";

import { useState } from "react";
import styles from "../page.module.css";
import Link from "next/link";

export default function SyncJobsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [message, setMessage] = useState("");
  const [previewData, setPreviewData] = useState<any>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [verificationData, setVerificationData] = useState<any>(null);

  const handlePreview = async () => {
    setIsPreviewing(true);
    setMessage("");
    setPreviewData(null);

    try {
      const response = await fetch("/api/sync-jobs");
      const data = await response.json();

      if (data.success) {
        setPreviewData(data);
        const collectionInfo = data.collectionName ? ` to "${data.collectionName}"` : '';
        const fieldInfo = data.fieldCount ? ` (${data.fieldCount} fields detected)` : '';
        setMessage(
          `✅ Found ${data.total} jobs. ${data.new} new jobs will be synced${collectionInfo}${fieldInfo}, ${data.existing} already exist.`
        );
      } else {
        const errorMsg = data.error || data.details || 'Unknown error';
        let fullError = errorMsg;
        
        // Add technical details if available
        if (data.details && data.details !== errorMsg) {
          fullError += `\n\nTechnical Details: ${data.details}`;
        }
        if (data.technicalDetails) {
          fullError += `\n\nAPI Response: ${data.technicalDetails}`;
        }
        
        setMessage(`❌ ${fullError}`);
        console.error('Preview error details:', data);
        
        // Show more details if available
        if (data.stack) {
          console.error('Error stack:', data.stack);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      setMessage(`❌ Failed to preview jobs: ${errorMsg}`);
      console.error('Preview fetch error:', error);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleVerifyCollection = async () => {
    setIsVerifying(true);
    setMessage("");
    setVerificationData(null);

    try {
      const response = await fetch("/api/verify-collection");
      const data = await response.json();

      if (data.success) {
        setVerificationData(data);
        setMessage(
          `✅ Collection Verified!\n\n` +
          `Collection: "${data.collection.name}"\n` +
          `Total Items: ${data.items.total}\n` +
          `- Drafts: ${data.items.drafts}\n` +
          `- Live: ${data.items.live}\n` +
          `- Archived: ${data.items.archived}\n` +
          `Fields: ${data.collection.fieldCount}`
        );
      } else {
        setMessage(
          `❌ Verification Failed!\n\n` +
          `Error: ${data.error || 'Unknown error'}\n` +
          `Details: ${data.details || 'No details available'}`
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      setMessage(`❌ Failed to verify collection: ${errorMsg}`);
      console.error('Verification error:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setMessage("");

    try {
      const response = await fetch("/api/test-external-api");
      const data = await response.json();

      if (data.success) {
        const bodyInfo = data.isArray 
          ? `Array with ${Array.isArray(data.body) ? data.body.length : 'unknown'} items`
          : typeof data.body === 'object' 
            ? 'Object' 
            : 'Text/Other';
        setMessage(
          `✅ Connection successful!\n\n` +
          `Status: ${data.status} ${data.statusText}\n` +
          `Content-Type: ${data.headers['content-type'] || 'Not specified'}\n` +
          `Response Type: ${bodyInfo}`
        );
      } else {
        setMessage(
          `❌ Connection failed!\n\n` +
          `Error: ${data.error || 'Unknown error'}\n` +
          `Status: ${data.status || 'N/A'}\n` +
          `Error Type: ${data.errorType || 'N/A'}`
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      setMessage(`❌ Failed to test connection: ${errorMsg}`);
      console.error('Test connection error:', error);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSync = async () => {
    setIsLoading(true);
    setMessage("");
    setSyncResult(null);

    try {
      const response = await fetch("/api/sync-jobs", {
        method: "POST",
      });
      const data = await response.json();

      if (data.success) {
        setSyncResult(data);
        const collectionInfo = data.collectionName ? ` to "${data.collectionName}"` : '';
        let message = `✅ Sync completed! ${data.synced} jobs synced${collectionInfo}, ${data.skipped} skipped.`;
        
        // Add verification details if available
        if (data.itemsBeforeSync !== undefined && data.itemsAfterSync !== undefined) {
          message += `\n\n📊 Collection Status:`;
          message += `\n- Items before sync: ${data.itemsBeforeSync}`;
          message += `\n- Items after sync: ${data.itemsAfterSync}`;
          message += `\n- Items added: ${data.itemsAdded || 0}`;
          
          if (data.itemsAdded !== data.synced) {
            message += `\n\n⚠️ Note: ${data.synced} items were synced but only ${data.itemsAdded} were added to the collection.`;
            message += `\nThis might indicate some items already existed or there was an issue.`;
          }
        }
        
        // Add field information if available
        if (data.availableFields && data.availableFields.length > 0) {
          message += `\n\n📋 Collection Fields (${data.fieldCount || data.availableFields.length}):`;
          message += `\n${data.availableFields.slice(0, 10).join(', ')}`;
          if (data.availableFields.length > 10) {
            message += `\n... and ${data.availableFields.length - 10} more fields`;
          }
        }
        
        if (data.errors && data.errors.length > 0) {
          message += `\n\n⚠️ ${data.errors.length} error(s) occurred:`;
          data.errors.slice(0, 5).forEach((error: string) => {
            message += `\n• ${error.substring(0, 100)}${error.length > 100 ? '...' : ''}`;
          });
          if (data.errors.length > 5) {
            message += `\n... and ${data.errors.length - 5} more errors (check console for full details)`;
          }
          console.error("Sync errors:", data.errors);
        }
        
        setMessage(message);
      } else {
        const errorMsg = data.error || data.details || 'Unknown error';
        let fullError = errorMsg;
        
        if (data.details && data.details !== errorMsg) {
          fullError += `\n\nTechnical Details: ${data.details}`;
        }
        if (data.technicalDetails) {
          fullError += `\n\nAPI Response: ${data.technicalDetails}`;
        }
        
        setMessage(`❌ ${fullError}`);
        console.error('Sync error details:', data);
      }
    } catch (error) {
      setMessage(`❌ Failed to sync jobs: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.apiData}>
          <div
            style={{
              marginBottom: "2rem",
              paddingTop: "1rem",
              paddingBottom: "1.5rem",
              borderBottom: "2px solid rgba(110, 86, 207, 0.3)",
            }}
          >
            <h4
              style={{
                fontSize: "2.25rem",
                fontWeight: "700",
                margin: "0 0 0.75rem 0",
                color: "#ffffff",
                textAlign: "center",
              }}
            >
              Sync Jobs from External API
            </h4>
            <p
              style={{
                color: "#a0a3bd",
                fontSize: "1rem",
                margin: 0,
                background: "rgba(110, 86, 207, 0.1)",
                padding: "0.75rem 1.5rem",
                borderRadius: "8px",
                width: "100%",
                textAlign: "center",
              }}
            >
              Fetch jobs from external API and automatically sync to Webflow CMS
            </p>
            {previewData?.collectionName && (
              <p
                style={{
                  color: "#6E56CF",
                  fontSize: "0.9rem",
                  margin: "0.5rem 0 0 0",
                  background: "rgba(110, 86, 207, 0.15)",
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  width: "100%",
                  textAlign: "center",
                  fontWeight: "600",
                }}
              >
                📦 Target Collection: <strong>{previewData.collectionName}</strong> (ID: {previewData.collectionId})
              </p>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
              alignItems: "center",
              marginBottom: "2rem",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "1rem",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <button
                onClick={handleVerifyCollection}
                disabled={isVerifying || isPreviewing || isLoading || isTesting}
                style={{
                  padding: "1rem 2rem",
                  background:
                    isVerifying || isPreviewing || isLoading || isTesting
                      ? "rgba(107, 114, 128, 0.5)"
                      : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "1rem",
                  fontWeight: "600",
                  cursor: isVerifying || isPreviewing || isLoading || isTesting ? "not-allowed" : "pointer",
                  transition: "all 0.3s ease",
                  boxShadow:
                    isVerifying || isPreviewing || isLoading || isTesting
                      ? "none"
                      : "0 4px 16px rgba(245, 158, 11, 0.4)",
                }}
              >
                {isVerifying ? "⏳ Verifying..." : "🔍 Verify Collection"}
              </button>
              <button
                onClick={handleTestConnection}
                disabled={isTesting || isPreviewing || isLoading || isVerifying}
                style={{
                  padding: "1rem 2rem",
                  background:
                    isTesting || isPreviewing || isLoading || isVerifying
                      ? "rgba(107, 114, 128, 0.5)"
                      : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "1rem",
                  fontWeight: "600",
                  cursor: isTesting || isPreviewing || isLoading || isVerifying ? "not-allowed" : "pointer",
                  transition: "all 0.3s ease",
                  boxShadow:
                    isTesting || isPreviewing || isLoading || isVerifying
                      ? "none"
                      : "0 4px 16px rgba(59, 130, 246, 0.4)",
                }}
              >
                {isTesting ? "⏳ Testing..." : "🔌 Test Connection"}
              </button>
              <button
                onClick={handlePreview}
                disabled={isPreviewing || isLoading || isTesting || isVerifying}
                style={{
                  padding: "1rem 2rem",
                  background:
                    isPreviewing || isLoading || isTesting || isVerifying
                      ? "rgba(107, 114, 128, 0.5)"
                      : "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "1rem",
                  fontWeight: "600",
                  cursor: isPreviewing || isLoading || isTesting || isVerifying ? "not-allowed" : "pointer",
                  transition: "all 0.3s ease",
                  boxShadow:
                    isPreviewing || isLoading || isTesting || isVerifying
                      ? "none"
                      : "0 4px 16px rgba(5, 150, 105, 0.4)",
                }}
              >
                {isPreviewing ? "⏳ Previewing..." : "👁️ Preview Jobs"}
              </button>

              <button
                onClick={handleSync}
                disabled={isLoading || isPreviewing || isTesting || isVerifying}
                style={{
                  padding: "1rem 2rem",
                  background:
                    isLoading || isPreviewing || isTesting || isVerifying
                      ? "rgba(107, 114, 128, 0.5)"
                      : "linear-gradient(135deg, #6E56CF 0%, #8b73e0 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "1rem",
                  fontWeight: "600",
                  cursor: isLoading || isPreviewing || isTesting || isVerifying ? "not-allowed" : "pointer",
                  transition: "all 0.3s ease",
                  boxShadow:
                    isLoading || isPreviewing || isTesting || isVerifying
                      ? "none"
                      : "0 4px 16px rgba(110, 86, 207, 0.4)",
                }}
              >
                {isLoading ? "⏳ Syncing..." : "✨ Sync to Webflow"}
              </button>
            </div>

            {message && (
              <div
                style={{
                  padding: "1rem 1.5rem",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  fontWeight: "500",
                  maxWidth: "800px",
                  width: "100%",
                  background: message.includes("✅")
                    ? "rgba(34, 197, 94, 0.1)"
                    : "rgba(239, 68, 68, 0.1)",
                  border: `1px solid ${
                    message.includes("✅")
                      ? "rgba(34, 197, 94, 0.3)"
                      : "rgba(239, 68, 68, 0.3)"
                  }`,
                  color: message.includes("✅") ? "#22c55e" : "#ef4444",
                  whiteSpace: "pre-line",
                  textAlign: "left",
                }}
              >
                {message}
                {message.includes("❌") && (
                  <div style={{ marginTop: "1rem", fontSize: "0.875rem", color: "#a0a3bd" }}>
                    <strong>💡 Troubleshooting:</strong>
                    <ul style={{ marginTop: "0.5rem", paddingLeft: "1.5rem" }}>
                      <li>Check if the external API is accessible</li>
                      <li>Try again in a few minutes (the API server may be temporarily down)</li>
                      <li>Verify the API URL is correct: <code style={{ background: "rgba(0,0,0,0.2)", padding: "2px 4px", borderRadius: "3px" }}>https://ocado-jobs-proxy.himanshuchawla569.workers.dev/?format=json</code></li>
                      {message.includes("HTML error page") && (
                        <li style={{ color: "#fbbf24", fontWeight: "600" }}>
                          ⚠️ The API is returning an HTML error page - this usually means the server is down or blocked by Cloudflare
                        </li>
                      )}
                      <li>Contact the API provider if the issue persists</li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {previewData && (
              <div
                style={{
                  width: "100%",
                  maxWidth: "800px",
                  background: "rgba(110, 86, 207, 0.05)",
                  borderRadius: "12px",
                  padding: "1.5rem",
                  border: "1px solid rgba(110, 86, 207, 0.2)",
                }}
              >
                <h5
                  style={{
                    color: "#ffffff",
                    fontSize: "1.25rem",
                    marginBottom: "1rem",
                  }}
                >
                  Preview Results
                </h5>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "1rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div
                    style={{
                      padding: "1rem",
                      background: "rgba(110, 86, 207, 0.1)",
                      borderRadius: "8px",
                    }}
                  >
                    <div style={{ color: "#a0a3bd", fontSize: "0.875rem" }}>
                      Total Jobs
                    </div>
                    <div
                      style={{ color: "#ffffff", fontSize: "1.5rem", fontWeight: "700" }}
                    >
                      {previewData.total}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "1rem",
                      background: "rgba(34, 197, 94, 0.1)",
                      borderRadius: "8px",
                    }}
                  >
                    <div style={{ color: "#a0a3bd", fontSize: "0.875rem" }}>
                      New Jobs
                    </div>
                    <div
                      style={{ color: "#22c55e", fontSize: "1.5rem", fontWeight: "700" }}
                    >
                      {previewData.new}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "1rem",
                      background: "rgba(251, 191, 36, 0.1)",
                      borderRadius: "8px",
                    }}
                  >
                    <div style={{ color: "#a0a3bd", fontSize: "0.875rem" }}>
                      Existing
                    </div>
                    <div
                      style={{ color: "#fbbf24", fontSize: "1.5rem", fontWeight: "700" }}
                    >
                      {previewData.existing}
                    </div>
                  </div>
                </div>

                {previewData.preview && previewData.preview.length > 0 && (
                  <div
                    style={{
                      maxHeight: "400px",
                      overflowY: "auto",
                      border: "1px solid rgba(110, 86, 207, 0.2)",
                      borderRadius: "8px",
                      padding: "1rem",
                    }}
                  >
                    {previewData.preview.slice(0, 10).map((job: any, index: number) => (
                      <div
                        key={index}
                        style={{
                          padding: "0.75rem",
                          marginBottom: "0.5rem",
                          background: job.willSync
                            ? "rgba(34, 197, 94, 0.05)"
                            : "rgba(251, 191, 36, 0.05)",
                          borderRadius: "6px",
                          border: `1px solid ${
                            job.willSync
                              ? "rgba(34, 197, 94, 0.2)"
                              : "rgba(251, 191, 36, 0.2)"
                          }`,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <div style={{ color: "#ffffff", fontWeight: "600" }}>
                              {job.name}
                            </div>
                            <div style={{ color: "#a0a3bd", fontSize: "0.875rem" }}>
                              {typeof job.company === 'string' ? job.company : job.company?.name || job.company?.companyName || 'N/A'} • {typeof job.location === 'string' ? job.location : job.location?.name || job.location?.location_name || job.location?.address || 'N/A'}
                            </div>
                          </div>
                          <span
                            style={{
                              padding: "0.25rem 0.75rem",
                              borderRadius: "12px",
                              fontSize: "0.75rem",
                              fontWeight: "600",
                              background: job.willSync
                                ? "rgba(34, 197, 94, 0.2)"
                                : "rgba(251, 191, 36, 0.2)",
                              color: job.willSync ? "#22c55e" : "#fbbf24",
                            }}
                          >
                            {job.willSync ? "✨ New" : "⚠️ Exists"}
                          </span>
                        </div>
                      </div>
                    ))}
                    {previewData.preview.length > 10 && (
                      <div style={{ color: "#a0a3bd", textAlign: "center", marginTop: "0.5rem" }}>
                        ... and {previewData.preview.length - 10} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {syncResult && (
              <div
                style={{
                  width: "100%",
                  maxWidth: "600px",
                  background: "rgba(34, 197, 94, 0.05)",
                  borderRadius: "12px",
                  padding: "1.5rem",
                  border: "1px solid rgba(34, 197, 94, 0.2)",
                }}
              >
                <h5
                  style={{
                    color: "#ffffff",
                    fontSize: "1.25rem",
                    marginBottom: "1rem",
                  }}
                >
                  Sync Results
                </h5>
                <div style={{ color: "#a0a3bd" }}>
                  <div>✅ Synced: {syncResult.synced} jobs</div>
                  <div>⏭️ Skipped: {syncResult.skipped} jobs</div>
                  <div>📊 Total: {syncResult.total} jobs</div>
                </div>
              </div>
            )}
          </div>

          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <Link
              href="/"
              style={{
                color: "#6E56CF",
                textDecoration: "none",
                fontWeight: "600",
              }}
            >
              ← Back to Events
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

