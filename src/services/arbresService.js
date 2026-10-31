import { reactive, readonly, toRaw } from "vue";
import { chargerArbres } from "./donneesArbres.js";
import { invoke } from "@tauri-apps/api/core";
import { rechercherParEspece } from "./rechercheArbres.js";
import { calculerResume } from "./statistiquesService.js";

const tauriActif = () =>
  typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
const versRust = (arbre) => ({
  id: arbre.id == null ? "" : String(arbre.id),
  numeroInventaire:
    arbre.numeroInventaire == null ? null : Number(arbre.numeroInventaire),
  essenceFr: arbre.essenceFr,
  essenceLatin: arbre.essenceLatin || "",
  arrondissement: arbre.arrondissement,
  diametre: arbre.diametre == null ? null : Number(arbre.diametre),
  latitude: Number(arbre.latitude),
  longitude: Number(arbre.longitude),
});

export function obtenirMessageErreur(
  erreur,
  messageParDefaut = "Une erreur est survenue.",
) {
  const message =
    typeof erreur === "string"
      ? erreur
      : erreur && typeof erreur.message === "string"
        ? erreur.message
        : "";
  return message.trim() || messageParDefaut;
}

export function validerArbre(donnees) {
  const erreurs = {};
  for (const [champ, titre] of [
    ["essenceFr", "L’essence"],
    ["arrondissement", "L’arrondissement"],
  ]) {
    if (typeof donnees[champ] !== "string" || !donnees[champ].trim())
      erreurs[champ] = `${titre} est obligatoire.`;
    else if (donnees[champ].trim().length > 120)
      erreurs[champ] = "Maximum de 120 caractères.";
  }
  if (
    typeof donnees.essenceLatin === "string" &&
    donnees.essenceLatin.trim().length > 120
  )
    erreurs.essenceLatin = "Maximum de 120 caractères.";
  if (
    typeof donnees.observation === "string" &&
    donnees.observation.trim().length > 1000
  )
    erreurs.observation =
      "L’observation doit contenir au maximum 1 000 caractères.";
  for (const [champ, minimum, maximum, titre] of [
    ["diametre", 0.1, 1000, "Le diamètre"],
    ["longitude", -180, 180, "La longitude"],
    ["latitude", -90, 90, "La latitude"],
  ]) {
    const valeur = donnees[champ];
    if (
      valeur === null ||
      valeur === undefined ||
      String(valeur).trim() === "" ||
      !Number.isFinite(Number(valeur))
    )
      erreurs[champ] = `${titre} doit être un nombre.`;
    else if (Number(valeur) < minimum || Number(valeur) > maximum)
      erreurs[champ] = `${titre} doit être entre ${minimum} et ${maximum}.`;
  }
  return erreurs;
}

export { lireCsv } from "./donneesArbres.js";

// En navigateur, le service garde le mode mémoire pour les tests; dans Tauri, il passe par invoke().
export function creerServiceArbres(charger = chargerArbres) {
  const etat = reactive({
    arbres: [],
    favoris: [],
    chargement: false,
    initialise: false,
    erreur: "",
  });
  let requete = null;
  let prochainId = 1;
  function initialiser() {
    if (etat.initialise) return Promise.resolve();
    if (requete) return requete;
    etat.chargement = true;
    etat.erreur = "";
    requete = (
      tauriActif()
        ? invoke("lister_arbres").then(async (arbres) => {
            if (!arbres.length) {
              const initiaux = await charger();
              const avecIds = initiaux.map((arbre, index) => ({
                ...arbre,
                id: String(index + 1),
              }));
              await invoke("importer_arbres", {
                arbres: avecIds.map(versRust),
              });
              arbres = avecIds;
            }
            const [favoris, observations] = await Promise.all([
              invoke("lister_favoris"),
              invoke("lister_observations"),
            ]);
            return {
              arbres: arbres.map((arbre) => ({
                ...arbre,
                observation: observations[arbre.id] || "",
              })),
              favoris,
            };
          })
        : Promise.resolve().then(async () => ({
            arbres: await charger(),
            favoris: [],
          }))
    )
      .then(({ arbres, favoris }) => {
        etat.arbres = arbres;
        etat.favoris = favoris;
        etat.initialise = true;
      })
      .catch((erreur) => {
        etat.erreur = obtenirMessageErreur(
          erreur,
          "Impossible de charger les arbres.",
        );
      })
      .finally(() => {
        etat.chargement = false;
        requete = null;
      });
    return requete;
  }
  function preparer(donnees) {
    if (!etat.initialise)
      throw new Error("Attendez le chargement des données avant de continuer.");
    const erreurs = validerArbre(donnees);
    if (Object.keys(erreurs).length) throw new Error(Object.values(erreurs)[0]);
    return {
      essenceFr: donnees.essenceFr.trim(),
      essenceLatin: (donnees.essenceLatin || "").trim(),
      arrondissement: donnees.arrondissement.trim(),
      diametre: Number(donnees.diametre),
      longitude: Number(donnees.longitude),
      latitude: Number(donnees.latitude),
      observation: (donnees.observation || "").trim(),
    };
  }
  function ajouter(donnees) {
    const valeurs = preparer(donnees);
    if (tauriActif()) {
      return invoke("ajouter_arbre", {
        arbre: versRust({ ...valeurs, id: "" }),
      }).then(async (arbre) => {
        await invoke("sauvegarder_observation", {
          id: String(arbre.id),
          texte: valeurs.observation,
        });
        etat.arbres.push({ ...arbre, observation: valeurs.observation });
        return arbre.id;
      });
    }
    const arbre = {
      ...valeurs,
      id: `local-${prochainId++}`,
      numeroInventaire: null,
      observation: valeurs.observation,
    };
    etat.arbres.push(arbre);
    return arbre.id;
  }
  function modifier(id, donnees) {
    const valeurs = preparer(donnees);
    const arbre = etat.arbres.find(
      (element) => String(element.id) === String(id),
    );
    if (!arbre) throw new Error("Cet arbre n’existe plus.");
    if (tauriActif())
      return invoke("modifier_arbre", {
        id: String(id),
        arbre: versRust({ ...arbre, ...valeurs }),
      }).then(async () => {
        await invoke("sauvegarder_observation", {
          id: String(id),
          texte: valeurs.observation,
        });
        Object.assign(arbre, valeurs);
      });
    Object.assign(arbre, valeurs);
  }
  function supprimer(id) {
    const index = etat.arbres.findIndex(
      (arbre) => String(arbre.id) === String(id),
    );
    if (index < 0) throw new Error("Cet arbre n’existe plus.");
    if (tauriActif())
      return invoke("supprimer_arbre", { id: String(id) }).then(() => {
        etat.arbres.splice(index, 1);
        etat.favoris = etat.favoris.filter((favori) => favori !== id);
      });
    etat.arbres.splice(index, 1);
    etat.favoris = etat.favoris.filter(
      (favori) => String(favori) !== String(id),
    );
  }
  async function rechercher(arbres, recherche) {
    if (!tauriActif()) {
      return rechercherParEspece(arbres, recherche);
    }

    const resultats = await invoke("rechercher_arbres", {
      recherche,
    });

    const ids = new Set(resultats);
    const filter = toRaw(arbres).filter((arbre) => ids.has(String(arbre.id)));
    return filter;
  }
  async function obtenirStatistiques() {
    if (!tauriActif()) {
      return calculerResume(etat.arbres);
    }

    return await invoke("obtenir_statistiques");
  }
  function ajouterFavori(id) {
    if (!etat.arbres.some((arbre) => arbre.id === id))
      throw new Error("Cet arbre n’existe plus.");
    // Un même arbre ne peut apparaître qu’une seule fois dans les favoris.
    if (etat.favoris.includes(id)) return;
    if (tauriActif()) {
      return invoke("ajouter_favori", { id: String(id) }).then((favoris) => {
        etat.favoris = favoris;
      });
    }
    etat.favoris.push(id);
  }
  function retirerFavori(id) {
    if (tauriActif()) {
      return invoke("retirer_favori", { id: String(id) }).then((favoris) => {
        etat.favoris = favoris;
      });
    }
    etat.favoris = etat.favoris.filter((favori) => favori !== id);
  }
  return {
    etat: readonly(etat),
    initialiser,
    rechercher,
    obtenir: (id) => readonly(etat.arbres).find((arbre) => arbre.id === id),
    ajouter,
    modifier,
    supprimer,
    ajouterFavori,
    retirerFavori,
    estFavori: (id) => etat.favoris.includes(id),
    obtenirFavoris: () =>
      readonly(etat.arbres).filter((arbre) => etat.favoris.includes(arbre.id)),
    obtenirStatistiques,
  };
}

const normaliser = (texte) =>
  String(texte)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-CA");
export function filtrerArbres(
  arbres,
  recherche = "",
  arrondissement = "",
  tri = "essence",
) {
  const terme = normaliser(recherche.trim());
  return arbres
    .filter(
      (arbre) =>
        (!arrondissement || arbre.arrondissement === arrondissement) &&
        normaliser(
          `${arbre.essenceFr} ${arbre.essenceLatin} ${arbre.arrondissement} ${arbre.numeroInventaire ?? ""}`,
        ).includes(terme),
    )
    .slice()
    .sort((a, b) =>
      tri === "diametre"
        ? (b.diametre ?? -1) - (a.diametre ?? -1)
        : a.essenceFr.localeCompare(b.essenceFr, "fr-CA"),
    );
}
export { calculerResume } from "./statistiquesService.js";
export const arbresService = creerServiceArbres();
