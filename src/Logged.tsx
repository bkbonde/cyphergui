import * as React from "react";
import Tab from "./layout/Tab";
import Navbar from "./layout/Navbar";
import Start from "./page/Start";
import Query from "./page/Query";
import Node from "./page/Node";
import Label from "./page/Label";
import Type from "./page/Type";
import Relationship from "./page/Relationship";
import { EPage } from "./enums";
import { Button } from "./form";
import { ISettings, IStashEntry, ITabManager, TStashValue } from "./interfaces";
import db from "./db";
import { Integer } from "neo4j-driver";
import Stash from "./layout/Stash";
import Settings from "./layout/Settings";

interface ILoggedState {
    activeTab: string | null;
    tabs: { id: string; title: string; icon: string }[];
    contents: { id: string; page: EPage; props: object }[];
    toasts: { key: number; message: string; color: string; delay: number; timeout: NodeJS.Timeout }[];
    settingsModal: boolean;
    settings: ISettings;
    stashed: IStashEntry[];
}

/**
 * Logged page with tab management
 */
class Logged extends React.Component<{ handleLogout: () => void }, ILoggedState> {
    state: ILoggedState = {
        activeTab: null,
        tabs: [],
        contents: [],
        toasts: [],
        settingsModal: false,
        settings: localStorage.getItem("settings")
            ? JSON.parse(localStorage.getItem("settings"))
            : {
                  tableViewShowElementId: true,
                  closeEditAfterExecuteSuccess: true,
                  forceNamingRecommendations: true,
              },
        stashed: [],
    };

    components = {
        [EPage.Start]: Start,
        [EPage.Query]: Query,
        [EPage.Node]: Node,
        [EPage.Label]: Label,
        [EPage.Type]: Type,
        [EPage.Rel]: Relationship,
    };

    constructor(props) {
        super(props);

        const tabs = localStorage.getItem("tabs");
        if (tabs) {
            const parsed = JSON.parse(tabs);
            this.state.tabs = parsed.tabs;
            this.state.contents = parsed.contents;
            this.state.activeTab = parsed.activeTab;
        }
    }

    componentDidMount() {
        this.tabManager.add("Start", "fa-solid fa-play", EPage.Start, {}, "Start", false);

        window.addEventListener("beforeunload", () => {
            localStorage.setItem("tabs", JSON.stringify({ tabs: this.state.tabs, contents: this.state.contents, activeTab: this.state.activeTab }));
        });
    }

    tabManager: ITabManager = {
        /**
         * If already exists is switches on it
         */
        add: (title: string | { prefix: string; i?: any }, icon: string, page: EPage, props: object = {}, id?: string, active: boolean = true) => {
            if (typeof title === "object") {
                title = this.tabManager.generateName(title.prefix, title.i);
            }

            if (!id) {
                //auto generate id from props or title if not provided
                id = "id" in props && (props.id instanceof Integer || typeof props.id === "string") ? db.strId(props.id) : title;
                if ("database" in props) id += props.database;
            }

            this.setState(state => {
                if (!state.tabs.find(tab => tab.id === id)) {
                    //open new tab next to current active tab
                    const i: number = state.tabs.findIndex(t => t.id === state.activeTab);
                    if (i !== -1) state.tabs.splice(i + 1, 0, { id: id, title: title as string, icon: icon });
                    else state.tabs.push({ id: id, title: title as string, icon: icon });

                    state.contents.push({ id: id, page: page, props: props });
                }

                return {
                    tabs: state.tabs,
                    contents: state.contents,
                    activeTab: active || !state.activeTab ? id : state.activeTab,
                };
            });
        },
        close: (id: string, e?: React.PointerEvent) => {
            !!e && e.stopPropagation();

            this.setState(state => {
                let active = state.activeTab;
                if (active === id) {
                    let i: number = state.tabs.findIndex(tab => tab.id === id);
                    if (i > 0) active = state.tabs[i - 1].id;
                }

                return {
                    tabs: state.tabs.filter(tab => id !== tab.id),
                    contents: state.contents.filter(content => id !== content.id),
                    activeTab: active,
                };
            });
        },
        setActive: (id: string) => {
            this.setState(() => {
                return {
                    activeTab: id,
                };
            });
        },
        /**
         * Create tab name with requested prefix and index (it's calculated if omitted)
         */
        generateName: (prefix: string, i?: any): string => {
            if (i === undefined) i = Math.max(0, ...this.state.tabs.filter(t => t.title.indexOf(prefix) === 0).map(t => parseInt(t.title.split("#")[1]))) + 1;
            else if (db.isInteger(i)) i = db.neo4j.integer.toString(i);
            return prefix + "#" + i;
        },
    };

    stashManager = {
        //maybe add queries?
        add: (value: TStashValue, database: string) => {
            this.setState(state => {
                return {
                    stashed: this.stashManager.indexOf(value, state.stashed) === -1 ? state.stashed.concat({ id: new Date().getTime(), value: value, database: database }) : state.stashed,
                };
            });
        },
        remove: (id: number) => {
            this.setState(state => {
                return {
                    stashed: state.stashed.filter(s => s.id !== id),
                };
            });
        },
        indexOf: (value: TStashValue, stashed?: IStashEntry[]): number => {
            return (stashed || this.state.stashed).findIndex(s => {
                return (db.hasElementId && value.elementId === s.value.elementId) || value.identity === s.value.identity;
            });
        },
        empty: () => {
            if (this.state.stashed.length > 0) this.setState({ stashed: [] });
        },
        button: (value: TStashValue, database: string, color?: string): JSX.Element => {
            const i = this.stashManager.indexOf(value);
            return (
                <Button
                    title={i === -1 ? "Add to stash" : "Remove from stash"}
                    onClick={() => (i === -1 ? this.stashManager.add(value, database) : this.stashManager.remove(this.state.stashed[i].id))}
                    color={color}
                    icon={i === -1 ? "fa-solid fa-folder-plus" : "fa-solid fa-folder-minus"}
                />
            );
        },
    };

    toast = (message: string, color = "is-success", delay = 3) => {
        const i: number = new Date().getTime();
        this.setState({
            toasts: [
                {
                    key: i,
                    message: message,
                    color: color,
                    delay: delay,
                    timeout: setTimeout(() => this.discardToast(i), delay * 1000),
                },
                ...this.state.toasts,
            ],
        });
    };

    discardToast = (i: number) => {
        this.setState(state => {
            return {
                toasts: state.toasts.filter(t => t.key !== i),
            };
        });
    };

    render() {
        if (this.state.tabs.length === 0 || this.state.activeTab === null) return;

        return (
            <>
                <Navbar
                    handleLogout={this.props.handleLogout}
                    handleAddQueryTab={() => this.tabManager.add({ prefix: "Query" }, "fa-solid fa-terminal", EPage.Query)}
                    handleOpenSettings={() => this.setState({ settingsModal: true })}
                />

                <section className="tabs is-boxed sticky has-background-white">
                    <ul>
                        {this.state.tabs.map(tab => (
                            <Tab key={"tab-" + tab.id} active={tab.id === this.state.activeTab} handleClick={this.tabManager.setActive} handleRemove={this.tabManager.close} {...tab} />
                        ))}
                    </ul>
                </section>

                <section className={"container " + (this.state.activeTab === "Start" ? "" : "is-fluid")}>
                    {this.state.contents.map(content => {
                        const MyComponent: typeof React.Component = this.components[content.page];
                        return (
                            <MyComponent
                                key={"content-" + content.id}
                                active={content.id === this.state.activeTab}
                                tabName={this.state.tabs.filter(t => t.id === content.id)[0].title}
                                tabId={content.id}
                                tabManager={this.tabManager}
                                toast={this.toast}
                                stashManager={this.stashManager}
                                settings={this.state.settings}
                                {...content.props}
                            />
                        );
                    })}
                </section>

                <section className="notifications">
                    {this.state.toasts.map(toast => (
                        <div key={toast.key} className={"notification fadeOut " + toast.color} style={{ animationDelay: toast.delay - 1 + "s" }}>
                            <button className="delete" onClick={() => this.discardToast(toast.key)}></button>
                            {toast.message}
                        </div>
                    ))}
                </section>

                {this.state.settingsModal && (
                    <Settings
                        settings={this.state.settings}
                        handleChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const name = e.currentTarget.name;
                            const checked = e.currentTarget.checked;
                            this.setState(state => {
                                return { settings: { ...state.settings, [name]: checked } };
                            });
                        }}
                        handleClose={() => {
                            localStorage.setItem("settings", JSON.stringify(this.state.settings));
                            this.setState({ settingsModal: false });
                        }}
                    />
                )}

                <Stash stashed={this.state.stashed} settings={this.state.settings} tabManager={this.tabManager} stashManager={this.stashManager} />
            </>
        );
    }
}

export default Logged;