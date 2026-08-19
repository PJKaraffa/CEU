
// ============================================================
// SUPABASE CONNECTION
// ============================================================

const SUPABASE_URL = "https://aljrlwiguzaovxrrdlrv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Z5jAPgAdKUCbxUEhU6exZw_FkXgQ9m0";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


// ============================================================
// GLOBAL VARIABLES
// ============================================================

let currentUser = null;
let currentProfile = null;

let myRecords = [];
let allRecords = [];
let profiles = [];

let targetHours = 90;


// ============================================================
// SHORTCUT
// ============================================================

const $ = id => document.getElementById(id);


// ============================================================
// START APPLICATION
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);


async function initializeApp() {

    bindEvents();

    setDefaultDate();

    const {
        data: { session },
        error
    } = await supabaseClient.auth.getSession();


    if (error) {
        console.error("Session error:", error);
    }


    if (session) {
        await loadApplication(session.user);
    }
}


// ============================================================
// BIND EVENTS
// ============================================================

function bindEvents() {

    // LOGIN
    $("loginButton").addEventListener(
        "click",
        login
    );


    $("loginPassword").addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {
                login();
            }

        }
    );


    // LOGOUT
    $("logoutButton").addEventListener(
        "click",
        logout
    );


    // SAVE WORKSHOP
    $("ceuForm").addEventListener(
        "submit",
        saveRecord
    );


    // CANCEL EDIT
    $("cancelEditButton").addEventListener(
        "click",
        resetForm
    );


    // ========================================================
    // AUTOMATIC CEU PREVIEW
    // SQL IS STILL THE OFFICIAL CALCULATION
    // ========================================================

    $("hours").addEventListener(
        "input",
        calculateCEUPreview
    );


    // NAVIGATION
    document
        .querySelectorAll(".nav-button")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    showView(
                        button.dataset.view
                    );

                }
            );

        });


    // MY RECORD FILTERS
    $("mySearch").addEventListener(
        "input",
        renderMyRecords
    );


    $("myStatus").addEventListener(
        "change",
        renderMyRecords
    );


    // ADMIN FILTERS
    $("adminSearch").addEventListener(
        "input",
        renderAdminRecords
    );


    $("adminTeacherFilter").addEventListener(
        "change",
        renderAdminRecords
    );


    $("adminStatusFilter").addEventListener(
        "change",
        renderAdminRecords
    );


    // REVIEW MODAL
    $("closeReviewButton").addEventListener(
        "click",
        closeReviewModal
    );


    $("approveButton").addEventListener(
        "click",
        () => reviewRecord("approved")
    );


    $("rejectButton").addEventListener(
        "click",
        () => reviewRecord("rejected")
    );


    // EXPORTS
    $("exportMyButton").addEventListener(
        "click",
        () => exportCSV(
            myRecords,
            "My_CEU_Records.csv"
        )
    );


    $("adminExportButton").addEventListener(
        "click",
        () => exportCSV(
            allRecords,
            "District_CEU_Records.csv"
        )
    );
}


// ============================================================
// AUTOMATIC CEU PREVIEW
//
// 10 HOURS = 1 CEU
//
// IMPORTANT:
// This is only for displaying the calculation to the teacher.
// Supabase SQL calculates and stores the official CEU value.
// ============================================================

function calculateCEUPreview() {

    const hours =
        Number($("hours").value) || 0;

    const ceu =
        hours / 10;


    $("ceu").value =
        ceu.toFixed(2);
}


// ============================================================
// LOGIN
// ============================================================

async function login() {

    clearMessage("loginMessage");


    const email =
        $("loginEmail")
            .value
            .trim();


    const password =
        $("loginPassword")
            .value;


    if (!email || !password) {

        showMessage(
            "loginMessage",
            "Enter your email and password.",
            "error"
        );

        return;
    }


    $("loginButton").disabled = true;


    const {
        data,
        error
    } = await supabaseClient
        .auth
        .signInWithPassword({
            email,
            password
        });


    $("loginButton").disabled = false;


    if (error) {

        showMessage(
            "loginMessage",
            error.message,
            "error"
        );

        return;
    }


    await loadApplication(
        data.user
    );
}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

    await supabaseClient
        .auth
        .signOut();


    currentUser = null;
    currentProfile = null;

    myRecords = [];
    allRecords = [];
    profiles = [];


    $("app")
        .classList
        .add("hidden");


    $("loginPage")
        .classList
        .remove("hidden");


    $("loginEmail").value = "";
    $("loginPassword").value = "";
}


// ============================================================
// LOAD APPLICATION
// ============================================================

async function loadApplication(user) {

    currentUser = user;


    const {
        data,
        error
    } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();


    if (error) {

        console.error(
            "Profile error:",
            error
        );

        alert(
            "Unable to load your profile: " +
            error.message
        );

        return;
    }


    currentProfile = data;


    // HEADER
    $("headerName").textContent =
        currentProfile.full_name ||
        currentProfile.email;


    $("headerRole").textContent =
        currentProfile.role === "admin"
            ? "Administrator"
            : "Teacher";


    // ADMIN TAB
    if (currentProfile.role === "admin") {

        $("adminTab")
            .classList
            .remove("hidden");

    } else {

        $("adminTab")
            .classList
            .add("hidden");
    }


    // SHOW APPLICATION
    $("loginPage")
        .classList
        .add("hidden");


    $("app")
        .classList
        .remove("hidden");


    await loadSettings();

    await refreshAll();

    showView(
        "dashboardView"
    );
}


// ============================================================
// LOAD SETTINGS
// ============================================================

async function loadSettings() {

    const {
        data,
        error
    } = await supabaseClient
        .from("ceu_settings")
        .select("*")
        .eq(
            "setting_name",
            "target_hours"
        )
        .maybeSingle();


    if (error) {

        console.error(
            "Settings error:",
            error
        );

        return;
    }


    if (
        data &&
        data.numeric_value !== null
    ) {

        targetHours =
            Number(
                data.numeric_value
            );
    }
}


// ============================================================
// REFRESH ALL DATA
// ============================================================

async function refreshAll() {

    await loadMyRecords();


    if (
        currentProfile &&
        currentProfile.role === "admin"
    ) {

        await loadProfiles();

        await loadAllRecords();
    }
}


// ============================================================
// LOAD MY RECORDS
// ============================================================

async function loadMyRecords() {

    const {
        data,
        error
    } = await supabaseClient
        .from("ceu_records")
        .select("*")
        .eq(
            "teacher_id",
            currentUser.id
        )
        .order(
            "workshop_date",
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            "My records error:",
            error
        );

        return;
    }


    myRecords =
        data || [];


    renderDashboard();

    renderMyRecords();
}


// ============================================================
// DASHBOARD
// ============================================================

function renderDashboard() {

    const totalHours =
        sum(
            myRecords,
            "hours"
        );


    const approvedHours =
        sum(
            myRecords.filter(
                record =>
                    record.status === "approved"
            ),
            "hours"
        );


    const pendingHours =
        sum(
            myRecords.filter(
                record =>
                    record.status === "pending"
            ),
            "hours"
        );


    // CEU COMES FROM SUPABASE GENERATED COLUMN
    const totalCEUs =
        sum(
            myRecords,
            "ceu"
        );


    $("totalHours").textContent =
        formatNumber(totalHours);


    $("approvedHours").textContent =
        formatNumber(approvedHours);


    $("pendingHours").textContent =
        formatNumber(pendingHours);


    $("totalCEUs").textContent =
        formatNumber(totalCEUs);


    // ========================================================
    // PROGRESS TOWARD TARGET
    // Uses approved hours only
    // ========================================================

    const percent =
        targetHours > 0
            ? Math.min(
                100,
                (
                    approvedHours /
                    targetHours
                ) * 100
            )
            : 0;


    $("goalText").textContent =
        `${formatNumber(approvedHours)} of ${formatNumber(targetHours)} hours`;


    $("goalPercent").textContent =
        `${percent.toFixed(0)}%`;


    $("progressFill")
        .style
        .width =
        `${percent}%`;


    const remaining =
        Math.max(
            0,
            targetHours -
            approvedHours
        );


    $("remainingText").textContent =
        remaining > 0
            ? `${formatNumber(remaining)} hours remaining`
            : "Professional learning goal reached";


    renderRecent();
}


// ============================================================
// RECENT RECORDS
// ============================================================

function renderRecent() {

    const records =
        myRecords.slice(
            0,
            5
        );


    $("recentRecords").innerHTML =
        records.length
            ?
            records
                .map(record => `

                    <tr>

                        <td>
                            ${formatDate(
                                record.workshop_date
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                record.workshop_name
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                record.hours
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                record.ceu
                            )}
                        </td>

                        <td>
                            ${statusBadge(
                                record.status
                            )}
                        </td>

                    </tr>

                `)
                .join("")

            :

            emptyRow(
                5,
                "No professional learning records yet."
            );
}


// ============================================================
// RENDER MY RECORDS
// ============================================================

function renderMyRecords() {

    const search =
        $("mySearch")
            .value
            .trim()
            .toLowerCase();


    const status =
        $("myStatus").value;


    const records =
        myRecords.filter(record => {

            const workshop =
                (
                    record.workshop_name ||
                    ""
                ).toLowerCase();


            const provider =
                (
                    record.provider ||
                    ""
                ).toLowerCase();


            const matchesSearch =
                !search ||
                workshop.includes(search) ||
                provider.includes(search);


            const matchesStatus =
                !status ||
                record.status === status;


            return (
                matchesSearch &&
                matchesStatus
            );
        });


    $("myRecordsTable").innerHTML =
        records.length
            ?
            records
                .map(
                    record =>
                        myRecordRow(record)
                )
                .join("")

            :

            emptyRow(
                8,
                "No matching records."
            );
}


// ============================================================
// MY RECORD ROW
// ============================================================

function myRecordRow(record) {

    const editable =
        record.status === "pending";


    return `

        <tr>

            <td>
                ${formatDate(
                    record.workshop_date
                )}
            </td>

            <td>

                <strong>
                    ${escapeHTML(
                        record.workshop_name
                    )}
                </strong>

            </td>

            <td>
                ${escapeHTML(
                    record.provider || ""
                )}
            </td>

            <td>
                ${formatNumber(
                    record.hours
                )}
            </td>

            <td>
                ${formatNumber(
                    record.ceu
                )}
            </td>

            <td>

                ${
                    record.document_path
                        ?
                        `
                        <button
                            onclick="viewDocument('${escapeJSString(record.document_path)}')"
                            class="secondary-button"
                        >
                            View
                        </button>
                        `
                        :
                        "—"
                }

            </td>

            <td>
                ${statusBadge(
                    record.status
                )}
            </td>

            <td>

                ${
                    editable
                        ?
                        `
                        <button
                            onclick="editRecord(${record.id})"
                            class="secondary-button"
                        >
                            Edit
                        </button>

                        <button
                            onclick="deleteRecord(${record.id})"
                            class="secondary-button"
                        >
                            Delete
                        </button>
                        `
                        :
                        ""
                }

            </td>

        </tr>

    `;
}


// ============================================================
// SAVE RECORD
//
// IMPORTANT:
// CEU IS NOT INCLUDED.
// SUPABASE CALCULATES CEU FROM HOURS.
// ============================================================

async function saveRecord(event) {

    event.preventDefault();


    clearMessage(
        "formMessage"
    );


    const id =
        $("recordId").value;


    const workshopName =
        $("workshopName")
            .value
            .trim();


    const workshopDate =
        $("workshopDate").value;


    const provider =
        $("provider")
            .value
            .trim();


    const hours =
        Number(
            $("hours").value
        );


    const description =
        $("description")
            .value
            .trim();


    // ========================================================
    // VALIDATION
    // ========================================================

    if (!workshopName) {

        showMessage(
            "formMessage",
            "Enter the workshop or course name.",
            "error"
        );

        return;
    }


    if (!workshopDate) {

        showMessage(
            "formMessage",
            "Enter the workshop date.",
            "error"
        );

        return;
    }


    if (
        !Number.isFinite(hours) ||
        hours <= 0
    ) {

        showMessage(
            "formMessage",
            "Professional learning hours must be greater than zero.",
            "error"
        );

        return;
    }


    // ========================================================
    // DOCUMENT UPLOAD
    // ========================================================

    let documentPath = null;
    let documentName = null;


    const file =
        $("documentFile")
            .files[0];


    if (file) {

        const uploadResult =
            await uploadDocument(file);


        if (!uploadResult) {
            return;
        }


        documentPath =
            uploadResult.path;


        documentName =
            file.name;
    }


    // ========================================================
    // RECORD SENT TO SUPABASE
    //
    // NOTICE:
    // NO CEU FIELD!
    // ========================================================

    const record = {

        teacher_id:
            currentUser.id,

        workshop_name:
            workshopName,

        workshop_date:
            workshopDate,

        provider:
            provider || null,

        hours:
            hours,

        description:
            description || null
    };


    // ONLY REPLACE DOCUMENT IF NEW FILE WAS UPLOADED

    if (documentPath) {

        record.document_path =
            documentPath;

        record.document_name =
            documentName;
    }


    let response;


    // ========================================================
    // UPDATE
    // ========================================================

    if (id) {

        response =
            await supabaseClient
                .from("ceu_records")
                .update(record)
                .eq(
                    "id",
                    id
                );
    }

    // ========================================================
    // INSERT
    // ========================================================

    else {

        response =
            await supabaseClient
                .from("ceu_records")
                .insert(record);
    }


    if (response.error) {

        console.error(
            "Save error:",
            response.error
        );


        showMessage(
            "formMessage",
            response.error.message,
            "error"
        );

        return;
    }


    showMessage(
        "formMessage",

        id
            ? "Workshop updated successfully."
            : "Workshop submitted successfully.",

        "success"
    );


    resetForm();

    await refreshAll();
}


// ============================================================
// UPLOAD DOCUMENT
// ============================================================

async function uploadDocument(file) {

    // OPTIONAL FILE SIZE LIMIT
    // 10 MB

    const maxSize =
        10 * 1024 * 1024;


    if (file.size > maxSize) {

        showMessage(
            "formMessage",
            "The document must be 10 MB or smaller.",
            "error"
        );

        return null;
    }


    const safeName =
        file.name.replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
        );


    const filePath =
        `${currentUser.id}/${Date.now()}_${safeName}`;


    const {
        data,
        error
    } = await supabaseClient
        .storage
        .from("ceu-documents")
        .upload(
            filePath,
            file,
            {
                cacheControl: "3600",
                upsert: false
            }
        );


    if (error) {

        console.error(
            "Upload error:",
            error
        );


        showMessage(
            "formMessage",
            "Document upload failed: " +
            error.message,
            "error"
        );

        return null;
    }


    return data;
}


// ============================================================
// VIEW DOCUMENT
// ============================================================

async function viewDocument(path) {

    if (!path) {
        return;
    }


    const {
        data,
        error
    } = await supabaseClient
        .storage
        .from("ceu-documents")
        .createSignedUrl(
            path,
            60
        );


    if (error) {

        console.error(
            "Document error:",
            error
        );


        alert(
            "Unable to open document: " +
            error.message
        );

        return;
    }


    window.open(
        data.signedUrl,
        "_blank",
        "noopener,noreferrer"
    );
}


// ============================================================
// EDIT RECORD
// ============================================================

function editRecord(id) {

    const record =
        myRecords.find(
            r =>
                Number(r.id) ===
                Number(id)
        );


    if (!record) {
        return;
    }


    if (
        record.status !== "pending"
    ) {

        alert(
            "Only pending records can be edited."
        );

        return;
    }


    $("recordId").value =
        record.id;


    $("workshopName").value =
        record.workshop_name || "";


    $("workshopDate").value =
        record.workshop_date || "";


    $("provider").value =
        record.provider || "";


    $("hours").value =
        record.hours || "";


    $("description").value =
        record.description || "";


    // ========================================================
    // DISPLAY SUPABASE'S CALCULATED CEU
    // ========================================================

    $("ceu").value =
        Number(
            record.ceu || 0
        ).toFixed(2);


    // File inputs cannot be pre-filled
    $("documentFile").value = "";


    $("cancelEditButton")
        .classList
        .remove("hidden");


    showView(
        "addView"
    );
}


// ============================================================
// DELETE RECORD
// ============================================================

async function deleteRecord(id) {

    const record =
        myRecords.find(
            r =>
                Number(r.id) ===
                Number(id)
        );


    if (!record) {
        return;
    }


    if (
        record.status !== "pending"
    ) {

        alert(
            "Only pending records can be deleted."
        );

        return;
    }


    const confirmed =
        confirm(
            `Delete "${record.workshop_name}"?`
        );


    if (!confirmed) {
        return;
    }


    // ========================================================
    // DELETE DATABASE RECORD FIRST
    // ========================================================

    const {
        error
    } = await supabaseClient
        .from("ceu_records")
        .delete()
        .eq(
            "id",
            id
        );


    if (error) {

        console.error(
            "Delete error:",
            error
        );

        alert(
            error.message
        );

        return;
    }


    // ========================================================
    // DELETE ASSOCIATED DOCUMENT
    // ========================================================

    if (record.document_path) {

        const {
            error: storageError
        } = await supabaseClient
            .storage
            .from("ceu-documents")
            .remove([
                record.document_path
            ]);


        if (storageError) {

            console.warn(
                "Record deleted but document could not be removed:",
                storageError
            );
        }
    }


    await refreshAll();
}


// ============================================================
// RESET FORM
// ============================================================

function resetForm() {

    $("ceuForm").reset();


    $("recordId").value = "";


    // CALCULATED CEU DISPLAY
    $("ceu").value = "0.00";


    $("cancelEditButton")
        .classList
        .add("hidden");


    setDefaultDate();
}


// ============================================================
// ADMIN - LOAD PROFILES
// ============================================================

async function loadProfiles() {

    const {
        data,
        error
    } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq(
            "active",
            true
        )
        .order(
            "full_name",
            {
                ascending: true
            }
        );


    if (error) {

        console.error(
            "Profiles error:",
            error
        );

        return;
    }


    profiles =
        data || [];


    populateTeacherFilter();
}


// ============================================================
// ADMIN - LOAD ALL RECORDS
// ============================================================

async function loadAllRecords() {

    const {
        data,
        error
    } = await supabaseClient
        .from("ceu_records")
        .select(`
            *,
            profiles!ceu_records_teacher_id_fkey (
                full_name,
                email,
                school,
                employee_id
            )
        `)
        .order(
            "workshop_date",
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            "Admin records error:",
            error
        );

        return;
    }


    allRecords =
        data || [];


    renderAdminStats();

    renderAdminRecords();
}


// ============================================================
// ADMIN STATISTICS
// ============================================================

function renderAdminStats() {

    const teachers =
        new Set(
            allRecords.map(
                record =>
                    record.teacher_id
            )
        );


    $("adminTeacherCount").textContent =
        teachers.size;


    $("adminRecordCount").textContent =
        allRecords.length;


    $("adminTotalHours").textContent =
        formatNumber(
            sum(
                allRecords,
                "hours"
            )
        );


    $("adminPendingCount").textContent =
        allRecords.filter(
            record =>
                record.status === "pending"
        ).length;
}


// ============================================================
// POPULATE TEACHER FILTER
// ============================================================

function populateTeacherFilter() {

    const teachers =
        profiles.filter(
            profile =>
                profile.role === "teacher"
        );


    $("adminTeacherFilter").innerHTML =

        `
        <option value="">
            All Teachers
        </option>
        `

        +

        teachers
            .map(profile => `

                <option value="${profile.id}">

                    ${escapeHTML(
                        profile.full_name ||
                        profile.email
                    )}

                </option>

            `)
            .join("");
}


// ============================================================
// ADMIN RECORDS
// ============================================================

function renderAdminRecords() {

    const search =
        $("adminSearch")
            .value
            .trim()
            .toLowerCase();


    const teacher =
        $("adminTeacherFilter")
            .value;


    const status =
        $("adminStatusFilter")
            .value;


    const records =
        allRecords.filter(record => {

            const profile =
                record.profiles || {};


            const teacherName =
                (
                    profile.full_name ||
                    profile.email ||
                    ""
                ).toLowerCase();


            const workshop =
                (
                    record.workshop_name ||
                    ""
                ).toLowerCase();


            const school =
                (
                    profile.school ||
                    ""
                ).toLowerCase();


            const matchesSearch =
                !search ||
                teacherName.includes(search) ||
                workshop.includes(search) ||
                school.includes(search);


            const matchesTeacher =
                !teacher ||
                record.teacher_id === teacher;


            const matchesStatus =
                !status ||
                record.status === status;


            return (
                matchesSearch &&
                matchesTeacher &&
                matchesStatus
            );
        });


    $("adminRecordsTable").innerHTML =
        records.length
            ?
            records
                .map(
                    record =>
                        adminRecordRow(record)
                )
                .join("")

            :

            emptyRow(
                9,
                "No records found."
            );
}


// ============================================================
// ADMIN RECORD ROW
// ============================================================

function adminRecordRow(record) {

    const profile =
        record.profiles || {};


    return `

        <tr>

            <td>

                <strong>

                    ${escapeHTML(
                        profile.full_name ||
                        profile.email ||
                        ""
                    )}

                </strong>

                ${
                    profile.employee_id
                        ?
                        `
                        <div class="employee-id">
                            ID: ${escapeHTML(profile.employee_id)}
                        </div>
                        `
                        :
                        ""
                }

            </td>


            <td>

                ${escapeHTML(
                    profile.school ||
                    ""
                )}

            </td>


            <td>

                ${formatDate(
                    record.workshop_date
                )}

            </td>


            <td>

                ${escapeHTML(
                    record.workshop_name
                )}

            </td>


            <td>

                ${formatNumber(
                    record.hours
                )}

            </td>


            <td>

                ${formatNumber(
                    record.ceu
                )}

            </td>


            <td>

                ${
                    record.document_path
                        ?
                        `
                        <button
                            onclick="viewDocument('${escapeJSString(record.document_path)}')"
                            class="secondary-button"
                        >
                            View
                        </button>
                        `
                        :
                        "—"
                }

            </td>


            <td>

                ${statusBadge(
                    record.status
                )}

            </td>


            <td>

                <button
                    onclick="openReviewModal(${record.id})"
                >
                    Review
                </button>

            </td>

        </tr>

    `;
}
// ============================================================
// OPEN REVIEW MODAL
// ============================================================

function openReviewModal(id) {

    const record =
        allRecords.find(
            r =>
                Number(r.id) ===
                Number(id)
        );


    if (!record) {
        return;
    }


    $("reviewRecordId").value =
        record.id;


    $("reviewNotes").value =
        record.admin_notes || "";


    $("reviewModal")
        .classList
        .remove("hidden");
}


// ============================================================
// CLOSE REVIEW MODAL
// ============================================================

function closeReviewModal() {

    $("reviewModal")
        .classList
        .add("hidden");


    $("reviewRecordId").value = "";

    $("reviewNotes").value = "";
}


// ============================================================
// APPROVE / REJECT RECORD
// ============================================================

async function reviewRecord(status) {

    if (
        !currentProfile ||
        currentProfile.role !== "admin"
    ) {

        alert(
            "Administrator access required."
        );

        return;
    }


    const id =
        $("reviewRecordId").value;


    if (!id) {
        return;
    }


    const notes =
        $("reviewNotes")
            .value
            .trim();


    const {
        error
    } = await supabaseClient
        .from("ceu_records")
        .update({

            status:
                status,

            admin_notes:
                notes || null,

            reviewed_by:
                currentUser.id,

            reviewed_at:
                new Date()
                    .toISOString()

        })
        .eq(
            "id",
            id
        );


    if (error) {

        console.error(
            "Review error:",
            error
        );

        alert(
            error.message
        );

        return;
    }


    closeReviewModal();

    await refreshAll();
}


// ============================================================
// EXPORT CSV
// ============================================================

function exportCSV(
    records,
    filename
) {

    if (!records.length) {

        alert(
            "There are no records to export."
        );

        return;
    }


    const rows = [

        [
            "Teacher",
            "Employee ID",
            "School",
            "Workshop Date",
            "Workshop",
            "Provider",
            "Hours",
            "CEUs",
            "Status",
            "Description"
        ]

    ];


    records.forEach(record => {

        const profile =
            record.profiles ||
            currentProfile ||
            {};


        rows.push([

            profile.full_name ||
            profile.email ||
            "",

            profile.employee_id ||
            "",

            profile.school ||
            "",

            record.workshop_date ||
            "",

            record.workshop_name ||
            "",

            record.provider ||
            "",

            record.hours ||
            0,

            record.ceu ||
            0,

            record.status ||
            "",

            record.description ||
            ""

        ]);
    });


    const csv =
        rows
            .map(row =>
                row
                    .map(csvEscape)
                    .join(",")
            )
            .join("\n");


    const blob =
        new Blob(
            [csv],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );


    const url =
        URL.createObjectURL(blob);


    const link =
        document.createElement("a");


    link.href =
        url;


    link.download =
        filename;


    document.body
        .appendChild(link);


    link.click();

    link.remove();


    URL.revokeObjectURL(url);
}


// ============================================================
// SHOW VIEW
// ============================================================

function showView(viewId) {

    document
        .querySelectorAll(".view")
        .forEach(view => {

            view
                .classList
                .add("hidden");

        });


    const selectedView =
        $(viewId);


    if (selectedView) {

        selectedView
            .classList
            .remove("hidden");
    }


    document
        .querySelectorAll(".nav-button")
        .forEach(button => {

            button
                .classList
                .toggle(
                    "active",
                    button.dataset.view ===
                    viewId
                );

        });
}


// ============================================================
// SUM
// ============================================================

function sum(
    records,
    field
) {

    return records.reduce(
        (total, record) =>

            total +
            Number(
                record[field] || 0
            ),

        0
    );
}


// ============================================================
// FORMAT NUMBER
// ============================================================

function formatNumber(value) {

    return Number(
        value || 0
    ).toLocaleString(
        undefined,
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }
    );
}


// ============================================================
// FORMAT DATE
// ============================================================

function formatDate(value) {

    if (!value) {
        return "";
    }


    const parts =
        value.split("-");


    if (parts.length !== 3) {
        return value;
    }


    const [
        year,
        month,
        day
    ] = parts;


    return `${month}/${day}/${year}`;
}


// ============================================================
// STATUS BADGE
// ============================================================

function statusBadge(status) {

    const safeStatus =
        [
            "approved",
            "pending",
            "rejected"
        ].includes(status)
            ? status
            : "pending";


    return `

        <span
            class="status status-${safeStatus}"
        >

            ${escapeHTML(
                safeStatus
            )}

        </span>

    `;
}


// ============================================================
// EMPTY TABLE ROW
// ============================================================

function emptyRow(
    columns,
    message
) {

    return `

        <tr>

            <td
                colspan="${columns}"
                style="
                    text-align:center;
                    padding:30px;
                    color:#667085;
                "
            >

                ${escapeHTML(
                    message
                )}

            </td>

        </tr>

    `;
}


// ============================================================
// DEFAULT DATE
// ============================================================

function setDefaultDate() {

    const input =
        $("workshopDate");


    if (
        input &&
        !input.value
    ) {

        const today =
            new Date();


        const year =
            today.getFullYear();


        const month =
            String(
                today.getMonth() + 1
            ).padStart(
                2,
                "0"
            );


        const day =
            String(
                today.getDate()
            ).padStart(
                2,
                "0"
            );


        input.value =
            `${year}-${month}-${day}`;
    }
}


// ============================================================
// SHOW MESSAGE
// ============================================================

function showMessage(
    element,
    message,
    type
) {

    const el =
        $(element);


    if (!el) {
        return;
    }


    el.textContent =
        message;


    el.className =
        `message ${type}`;
}


// ============================================================
// CLEAR MESSAGE
// ============================================================

function clearMessage(element) {

    const el =
        $(element);


    if (!el) {
        return;
    }


    el.textContent = "";

    el.className =
        "message";
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


// ============================================================
// ESCAPE STRING USED INSIDE ONCLICK
// ============================================================

function escapeJSString(value) {

    return String(
        value ?? ""
    )
        .replace(
            /\\/g,
            "\\\\"
        )
        .replace(
            /'/g,
            "\\'"
        );
}


// ============================================================
// CSV ESCAPE
// ============================================================

function csvEscape(value) {

    const string =
        String(
            value ?? ""
        );


    return `"${string.replace(
        /"/g,
        '""'
    )}"`;
}
