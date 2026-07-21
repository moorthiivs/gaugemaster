import React from "react";

function Analytics() {
    return (
        <div className="flex-1 p-4">
            <div className="bg-white shadow-lg rounded-2xl overflow-hidden h-[calc(100vh-2rem)]">
                <iframe
                    title="Power BI Report"
                    src="https://app.powerbi.com/view?r=eyJrIjoiNDdiODE0ZGQtOWExMS00NjBlLTlmYWMtYzRjNzNkZmJlMDQ0IiwidCI6ImQxYjE2Y2M1LTc3ZDMtNDE3Mi04YTAyLTc0NzIzZTAzYjRjZSJ9"
                    className="w-full h-full"
                    style={{ border: "none" }}
                    allowFullScreen
                />
            </div>
        </div>
    );
}

export default Analytics;
