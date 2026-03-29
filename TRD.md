# **Technical Requirements Document: PostgREST Web Admin**

## **1\. Executive Summary**

A lightweight, web-based administration tool for PostgreSQL databases exposed via **PostgREST**. Designed for local development, it provides a "pgAdmin-lite" experience for browsing schemas, inspecting metadata (columns, triggers, indexes), and performing CRUD operations on data.

## **2\. Tech Stack**

* **Frontend Framework:** [Quasar Framework](https://quasar.dev) (Vue 3, Vite)  
* **Templating Engine:** [Pug](https://pugjs.org/) (Jade)  
* **Backend:** PostgREST (Existing REST layer)  
* **Database:** PostgreSQL 12+  
* **State Management:** Pinia (for connection settings and schema caching)  
* **Icons:** Lucide-react or Material Icons (standard with Quasar)

## **3\. Database Bridge (The exec\_sql Function)**

To execute arbitrary SQL and fetch system-level metadata (triggers/indexes) that PostgREST might not expose natively, the following function must be created in the database:

CREATE OR REPLACE FUNCTION public.exec\_sql(query text)  
RETURNS json AS $$  
DECLARE  
    result json;  
BEGIN  
    \-- Executes query and wraps output in a JSON array  
    EXECUTE 'SELECT json\_agg(t) FROM (' || query || ') t' INTO result;  
    RETURN coalesce(result, '\[\]'::json);  
EXCEPTION WHEN OTHERS THEN  
    \-- Returns formatted error for the UI  
    RETURN json\_build\_object(  
        'error', SQLERRM,  
        'detail', SQLSTATE,  
        'hint', 'Ensure the query is a valid SELECT or returns a result set.'  
    );  
END;  
$$ LANGUAGE plpgsql SECURITY DEFINER;

*Note: This is intended for local dev usage only.*

## **4\. Functional Requirements**

### **4.1. Resource Explorer (Left Drawer)**

* **Tree Navigation:** A hierarchical QTree displaying:  
  * **Schemas:** Top-level grouping.  
  * **Tables:** Nested under schemas.  
    * **Columns:** List with data types and PK indicators.  
    * **Indexes:** List of indexes (Fetched via pg\_indexes).  
    * **Triggers:** List of triggers (Fetched via pg\_trigger).  
    * **Constraints:** FKs and Unique constraints.  
  * **Views:** List of available views.  
  * **Functions (RPC):** List of functions exposed by PostgREST.  
* **Lazy Loading:** Child nodes (columns/triggers) should only fetch data when the parent table node is expanded.

### **4.2. Data Browser & Editor**

* **Data Grid:** A responsive QTable for browsing records.  
* **Pagination:** Implementation of PostgREST Range headers for server-side pagination.  
* **Sorting:** Mapping QTable sort events to PostgREST order query parameters.  
* **Filtering:** UI for standard PostgREST operators (eq, ilike, is, gt, lt).  
* **CRUD Operations:**  
  * **Create:** Dialog for row insertion.  
  * **Edit:** Inline cell editing or row dialog using PATCH.  
  * **Delete:** Single or bulk deletion via DELETE.

### **4.3. Metadata Inspector**

* A "Structure" tab for the selected resource.  
* Displays raw DDL (if possible) or a detailed breakdown of column defaults, nullability, and foreign key relationships.

### **4.4. SQL Scratchpad**

* A raw text editor for arbitrary SQL execution.  
* Sends the query to the rpc/exec\_sql endpoint.  
* Displays results in a dynamic, read-only grid.

## **5\. UI Architecture (Quasar \+ Pug)**

### **5.1. Layout Structure**

* **Header:** PostgREST URL input, Auth Token field, and Global Refresh button.  
* **Drawer (Left):** ResourceTree.pug component.  
* **Main Content:** QTabs switching between:  
  * **Data View:** The grid and filters.  
  * **Structure:** Columns, Triggers, and Indexes table.  
  * **SQL Lab:** Query editor and results console.

### **5.2. Component Sample (Pug)**

//- Simplified Table Component Example  
div.q-pa-md  
  q-table(  
    :rows="rows"  
    :columns="columns"  
    :loading="loading"  
    @request="onScrollRequest"  
    row-key="id"  
    dense  
    flat  
    bordered  
  )  
    template(v-slot:top-left)  
      div.text-h6.row.items-center  
        q-icon(name="table\_chart" color="primary" size="sm" class="q-mr-sm")  
        span {{ activeTableName }}  
      
    template(v-slot:body-cell-actions="props")  
      q-td(:props="props")  
        q-btn(icon="edit" size="sm" flat round @click="editRow(props.row)")  
        q-btn(icon="delete" size="sm" flat round color="negative" @click="confirmDelete(props.row)")

## **6\. API Interaction Logic**

* **Base URL:** Configurable via UI.  
* **Headers:**  
  * Prefer: count=exact (for pagination total count).  
  * Prefer: return=representation (for immediate UI updates after CRUD).  
* **Error Handling:** Global interceptor to catch 401 (Unauthorized), 403 (Forbidden), and 404 (Table missing).

## **7\. Roadmap**

1. **Phase 1:** Setup Quasar/Pug and Axios connection to PostgREST root (/).  
2. **Phase 2:** Implement the Resource Tree with Schema/Table/Column discovery.  
3. **Phase 4:** Build the Data Grid with server-side pagination and sorting.  
4. **Phase 5:** Add CRUD dialogs and the SQL Scratchpad using exec\_sql.  
5. **Phase 6:** Implement Metadata panels for Triggers and Indexes.

7. prepare docker-compose
8. list connections ( i will provide URL of porstgrest API endpoint it should scan )
9. use localstorage for settings save ( urls of postgrest API ) 
10. prepare unit test and run, to pass all test, you could use existing docker posgrest + pogstgresql db ( smartpos database) to check if our frontend is working