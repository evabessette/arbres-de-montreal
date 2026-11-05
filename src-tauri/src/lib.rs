pub mod models;
pub mod statistiques;
pub mod validation;
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;

mod commands;
mod recherche;
mod repository;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let dossier = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dossier)?;
            app.manage(commands::AppState {
                chemin: dossier.join("arbres.json"),
                chemin_favoris: dossier.join("favoris.json"),
                chemin_observations: dossier.join("observations.json"),
                verrou: std::sync::Mutex::new(repository::charger_arbres(
                    &dossier.join("arbres.json"),
                )?),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::lister_arbres,
            commands::importer_arbres,
            commands::lister_favoris,
            commands::ajouter_favori,
            commands::retirer_favori,
            commands::lister_observations,
            commands::sauvegarder_observation,
            commands::ajouter_arbre,
            commands::modifier_arbre,
            commands::supprimer_arbre,
            commands::rechercher_arbres,
            commands::obtenir_statistiques
        ])
        .run(tauri::generate_context!());
    app.expect("erreur lors de l'exécution de l'application Tauri");
}
