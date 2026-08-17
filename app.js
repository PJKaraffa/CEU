const SUPABASE_URL =
    "YOUR_SUPABASE_URL";

const SUPABASE_ANON_KEY =
    "YOUR_SUPABASE_ANON_KEY";

const supabaseClient =
    supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );


let currentUser = null;
let currentProfile = null;

let myRecords = [];
let allRecords = [];
let profiles = [];

let targetHours = 90;


const $ = id =>
    document.getElementById(id);


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
        data: { session }
    } =
        await supabaseClient.auth.getSession();

    if (session) {

        await loadApplication(
            session.user
        );

    }

}


// ============================================================
// EVENTS
// ============================================================

function bindEvents() {

    $("loginButton")
        .addEventListener(
            "click",
            login
        );


    $("loginPassword")
        .addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {
                    login();
                }

            }
        );


    $("logoutButton")
        .addEventListener(
            "click",
            logout
        );


    $("ceuForm")
        .addEventListener(
            "submit",
            saveRecord
        );


    $("cancelEditButton")
        .addEventListener(
            "click",
            resetForm
        );


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


    $("mySearch")
        .addEventListener(
            "input",
            renderMyRecords
        );


    $("myStatus")
        .addEventListener(
            "change",
            renderMyRecords
        );


    $("adminSearch")
        .addEventListener(
            "input",
            renderAdminRecords
        );


    $("adminTeacherFilter")
        .addEventListener(
            "change",
            renderAdminRecords
        );


    $("adminStatusFilter")
        .addEventListener(
            "change",
            renderAdminRecords
        );


    $("closeReviewButton")
        .addEventListener(
            "click",
            closeReviewModal
        );


    $("approveButton")
        .addEventListener(
            "click",
            () =>
                reviewRecord("approved")
        );


    $("rejectButton")
        .addEventListener(
            "click",
            () =>
                reviewRecord("rejected")
        );


    $("exportMyButton")
        .addEventListener(
            "click",
            () =>
                exportCSV(
                    myRecords,
                    "My_CEU_Records.csv"
                )
        );


    $("adminExportButton")
        .addEventListener(
            "click",
            () =>
                exportCSV(
                    allRecords,
                    "District_CEU_Records.csv"
                )
        );

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


    if (
        !email ||
        !password
    ) {

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
    } =
        await supabaseClient
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


    $("app")
        .classList
        .add("hidden");


    $("loginPage")
        .classList
        .remove("hidden");

}


// ============================================================
// LOAD APP
// ============================================================

async function loadApplication(user) {

    currentUser = user;


    const {
        data,
        error
    } =
        await supabaseClient
            .from("profiles")
            .select("*")
            .eq(
                "id",
                user.id
            )
            .single();


    if (error) {

        alert(
            "Unable to load profile: " +
            error.message
        );

        return;

    }


    currentProfile = data;


    $("headerName").textContent =
        currentProfile.full_name ||
        currentProfile.email;


    $("headerRole").textContent =
        currentProfile.role === "admin"
            ? "Administrator"
            : "Teacher";


    if (
        currentProfile.role === "admin"
    ) {

        $("adminTab")
            .classList
            .remove("hidden");

    } else {

        $("adminTab")
            .classList
            .add("hidden");

    }


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
// SETTINGS
// ============================================================

async function loadSettings() {

    const {
        data
    } =
        await supabaseClient
            .from("ceu_settings")
            .select("*")
            .eq(
                "setting_name",
                "target_hours"
            )
            .maybeSingle();


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
// REFRESH
// ============================================================

async function refreshAll() {

    await loadMyRecords();


    if (
        currentProfile.role === "admin"
    ) {

        await loadProfiles();
        await loadAllRecords();

    }

}


// ============================================================
// MY RECORDS
// ============================================================

async function loadMyRecords() {

    const {
        data,
        error
    } =
        await supabaseClient
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

        console.error(error);
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

    const total =
        sum(
            myRecords,
            "hours"
        );


    const approved =
        sum(
            myRecords.filter(
                r =>
                    r.status === "approved"
            ),
            "hours"
        );


    const pending =
        sum(
            myRecords.filter(
                r =>
                    r.status === "pending"
            ),
            "hours"
        );


    const ceu =
        sum(
            myRecords,
            "ceu"
        );


    $("totalHours").textContent =
        formatNumber(total);


    $("approvedHours").textContent =
        formatNumber(approved);


    $("pendingHours").textContent =
        formatNumber(pending);


    $("totalCEUs").textContent =
        formatNumber(ceu);


    const percent =
        targetHours > 0
            ?
            Math.min(
                100,
                approved /
                targetHours *
                100
            )
            :
            0;


    $("goalText").textContent =
        `${formatNumber(approved)} of ${formatNumber(targetHours)} hours`;


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
            approved
        );


    $("remainingText").textContent =
        `${formatNumber(remaining)} hours remaining`;


    renderRecent();

}


// ============================================================
// RECENT
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
                            ${formatDate(record.workshop_date)}
                        </td>

                        <td>
                            ${escapeHTML(record.workshop_name)}
                        </td>

                        <td>
                            ${formatNumber(record.hours)}
                        </td>

                        <td>
                            ${formatNumber(record.ceu)}
                        </td>

                        <td>
                            ${statusBadge(record.status)}
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
        $("myStatus")
            .value;


    const records =
        myRecords.filter(record => {

            const matchesSearch =
                !search ||
                record.workshop_name
                    .toLowerCase()
                    .includes(search) ||

                (
                    record.provider || ""
                )
                    .toLowerCase()
                    .includes(search);


            const matchesStatus =
                !status ||
                record.status === status;


            return (
                matchesSearch &&
                matchesStatus
            );

        });


    $("myRecordsTable")
        .innerHTML =
        records.length
            ?
            records
                .map(record =>
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
// MY ROW
// ============================================================

function myRecordRow(record) {

    const editable =
        record.status === "pending";


    return `

        <tr>

            <td>
                ${formatDate(record.workshop_date)}
            </td>

            <td>
                <strong>
                    ${escapeHTML(record.workshop_name)}
                </strong>
            </td>

            <td>
                ${escapeHTML(record.provider || "")}
            </td>

            <td>
                ${formatNumber(record.hours)}
            </td>

            <td>
                ${formatNumber(record.ceu)}
            </td>

            <td>

                ${
                    record.document_path
                        ?
                        `<button
                            onclick="viewDocument('${record.document_path}')"
                            class="secondary-button">
                            View
                        </button>`
                        :
                        "—"
                }

            </td>

            <td>
                ${statusBadge(record.status)}
            </td>

            <td>

                ${
                    editable
                        ?
                        `
                            <button
                                onclick="editRecord(${record.id})"
                                class="secondary-button">
                                Edit
                            </button>

                            <button
                                onclick="deleteRecord(${record.id})"
                                class="secondary-button">
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


    const ceu =
        Number(
            $("ceu").value || 0
        );


    const description =
        $("description")
            .value
            .trim();


    if (
        !workshopName ||
        !workshopDate ||
        hours < 0
    ) {

        showMessage(
            "formMessage",
            "Complete all required fields.",
            "error"
        );

        return;

    }


    let documentPath = null;
    let documentName = null;


    const file =
        $("documentFile")
            .files[0];


    if (file) {

        const result =
            await uploadDocument(file);


        if (!result) {
            return;
        }


        documentPath =
            result.path;


        documentName =
            file.name;

    }


    const record = {

        teacher_id:
            currentUser.id,

        workshop_name:
            workshopName,

        workshop_date:
            workshopDate,

        provider,

        hours,

        ceu,

        description

    };


    if (documentPath) {

        record.document_path =
            documentPath;

        record.document_name =
            documentName;

    }


    let response;


    if (id) {

        response =
            await supabaseClient
                .from("ceu_records")
                .update(record)
                .eq(
                    "id",
                    id
                );

    } else {

        response =
            await supabaseClient
                .from("ceu_records")
                .insert(record);

    }


    if (response.error) {

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
            ?
            "Workshop updated successfully."
            :
            "Workshop submitted successfully.",
        "success"
    );


    resetForm();

    await refreshAll();

}


// ============================================================
// UPLOAD DOCUMENT
// ============================================================

async function uploadDocument(file) {

    const safeName =
        file.name
            .replace(
                /[^a-zA-Z0-9._-]/g,
                "_"
            );


    const filePath =
        `${currentUser.id}/${Date.now()}_${safeName}`;


    const {
        data,
        error
    } =
        await supabaseClient
            .storage
            .from("ceu-documents")
            .upload(
                filePath,
                file
            );


    if (error) {

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

    const {
        data,
        error
    } =
        await supabaseClient
            .storage
            .from("ceu-documents")
            .createSignedUrl(
                path,
                60
            );


    if (error) {

        alert(
            "Unable to open document: " +
            error.message
        );

        return;

    }


    window.open(
        data.signedUrl,
        "_blank"
    );

}


// ============================================================
// EDIT
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


    $("recordId").value =
        record.id;


    $("workshopName").value =
        record.workshop_name;


    $("workshopDate").value =
        record.workshop_date;


    $("provider").value =
        record.provider || "";


    $("hours").value =
        record.hours;


    $("ceu").value =
        record.ceu;


    $("description").value =
        record.description || "";


    $("cancelEditButton")
        .classList
        .remove("hidden");


    showView(
        "addView"
    );

}


// ============================================================
// DELETE
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
        !confirm(
            `Delete "${record.workshop_name}"?`
        )
    ) {
        return;
    }


    if (
        record.document_path
    ) {

        await supabaseClient
            .storage
            .from("ceu-documents")
            .remove([
                record.document_path
            ]);

    }


    const {
        error
    } =
        await supabaseClient
            .from("ceu_records")
            .delete()
            .eq(
                "id",
                id
            );


    if (error) {

        alert(error.message);
        return;

    }


    await refreshAll();

}


// ============================================================
// RESET FORM
// ============================================================

function resetForm() {

    $("ceuForm").reset();

    $("recordId").value = "";

    $("ceu").value = 0;

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
    } =
        await supabaseClient
            .from("profiles")
            .select("*")
            .eq(
                "active",
                true
            )
            .order(
                "full_name"
            );


    if (error) {

        console.error(error);
        return;

    }


    profiles =
        data || [];


    populateTeacherFilter();

}


// ============================================================
// ADMIN - LOAD RECORDS
// ============================================================

async function loadAllRecords() {

    const {
        data,
        error
    } =
        await supabaseClient
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

        console.error(error);
        return;

    }


    allRecords =
        data || [];


    renderAdminStats();

    renderAdminRecords();

}


// ============================================================
// ADMIN STATS
// ============================================================

function renderAdminStats() {

    const teachers =
        new Set(
            allRecords.map(
                r =>
                    r.teacher_id
            )
        );


    $("adminTeacherCount")
        .textContent =
        teachers.size;


    $("adminRecordCount")
        .textContent =
        allRecords.length;


    $("adminTotalHours")
        .textContent =
        formatNumber(
            sum(
                allRecords,
                "hours"
            )
        );


    $("adminPendingCount")
        .textContent =
        allRecords.filter(
            r =>
                r.status === "pending"
        ).length;

}


// ============================================================
// TEACHER FILTER
// ============================================================

function populateTeacherFilter() {

    const teachers =
        profiles.filter(
            p =>
                p.role === "teacher"
        );


    $("adminTeacherFilter")
        .innerHTML =

        `<option value="">
            All Teachers
        </option>` +

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

            const name =
                record.profiles
                    ?.full_name ||
                record.profiles
                    ?.email ||
                "";


            const matchesSearch =
                !search ||

                name
                    .toLowerCase()
                    .includes(search) ||

                record.workshop_name
                    .toLowerCase()
                    .includes(search);


            const matchesTeacher =
                !teacher ||
                record.teacher_id ===
                teacher;


            const matchesStatus =
                !status ||
                record.status ===
                status;


            return (
                matchesSearch &&
                matchesTeacher &&
                matchesStatus
            );

        });


    $("adminRecordsTable")
        .innerHTML =
        records.length
            ?
            records
                .map(record =>
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
// ADMIN ROW
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

            </td>

            <td>
                ${escapeHTML(
                    profile.school || ""
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
                        `<button
                            onclick="viewDocument('${record.document_path}')"
                            class="secondary-button">
                            View
                        </button>`
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
                    onclick="openReviewModal(${record.id})">
                    Review
                </button>

            </td>

        </tr>

    `;

}


// ============================================================
// REVIEW MODAL
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


function closeReviewModal() {

    $("reviewModal")
        .classList
        .add("hidden");


    $("reviewRecordId").value = "";

    $("reviewNotes").value = "";

}


// ============================================================
// APPROVE / REJECT
// ============================================================

async function reviewRecord(status) {

    const id =
        $("reviewRecordId")
            .value;


    if (!id) {
        return;
    }


    const notes =
        $("reviewNotes")
            .value
            .trim();


    const {
        error
    } =
        await supabaseClient
            .from("ceu_records")
            .update({

                status,

                admin_notes:
                    notes,

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

        alert(
            error.message
        );

        return;

    }


    closeReviewModal();

    await refreshAll();

}


// ============================================================
// CSV EXPORT
// ============================================================

function exportCSV(records, filename) {

    if (!records.length) {

        alert(
            "There are no records to export."
        );

        return;

    }


    const rows = [

        [
            "Teacher",
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


    link.href = url;
    link.download = filename;

    document.body
        .appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

}


// ============================================================
// VIEWS
// ============================================================

function showView(viewId) {

    document
        .querySelectorAll(".view")
        .forEach(view =>
            view
                .classList
                .add("hidden")
        );


    $(viewId)
        .classList
        .remove("hidden");


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
// HELPERS
// ============================================================

function sum(records, field) {

    return records.reduce(
        (total, record) =>
            total +
            Number(
                record[field] || 0
            ),
        0
    );

}


function formatNumber(value) {

    return Number(value || 0)
        .toLocaleString(
            undefined,
            {
                maximumFractionDigits: 2
            }
        );

}


function formatDate(value) {

    if (!value) {
        return "";
    }


    const [
        year,
        month,
        day
    ] =
        value.split("-");


    return `${month}/${day}/${year}`;

}


function statusBadge(status) {

    return `

        <span
            class="status status-${status}">
            ${escapeHTML(status)}
        </span>

    `;

}


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
                ${escapeHTML(message)}
            </td>

        </tr>

    `;

}


function setDefaultDate() {

    const input =
        $("workshopDate");


    if (
        input &&
        !input.value
    ) {

        input.value =
            new Date()
                .toISOString()
                .slice(0,10);

    }

}


function showMessage(
    element,
    message,
    type
) {

    const el =
        $(element);


    el.textContent =
        message;


    el.className =
        `message ${type}`;

}


function clearMessage(element) {

    const el =
        $(element);


    el.textContent = "";

    el.className =
        "message";

}


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