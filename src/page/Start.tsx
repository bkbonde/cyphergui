import * as React from "react";
import { Button, LabelButton, TypeButton } from "../form";
import { EPage } from "../enums";
import { IPageProps } from "../interfaces";
import db from "../db";

class Start extends React.Component<IPageProps> {
    state = {
        labels: [],
        types: [],
        serverInfo: {},
    };

    componentDidMount() {
        db.registerChangeDbCallback(this.requestData);
        this.requestData();
    }

    shouldComponentUpdate(nextProps: Readonly<IPageProps>) {
        if (nextProps.active && this.props.active !== nextProps.active) {
            this.requestData();
        }
        return true;
    }

    requestData = () => {
        Promise.all([
            db
                .getDriver()
                .session({ database: db.getActiveDb(), defaultAccessMode: db.neo4j.session.READ })
                .run("MATCH (n) WITH DISTINCT labels(n) AS ll UNWIND ll AS l RETURN collect(DISTINCT l) AS c"),
            db.getDriver().session({ database: db.getActiveDb(), defaultAccessMode: db.neo4j.session.READ }).run("MATCH ()-[n]-() RETURN collect(DISTINCT type(n)) AS c"),
            db.getDriver().getServerInfo(),
        ])
            .then(responses => {
                this.setState({
                    labels: responses[0].records[0].get("c"),
                    types: responses[1].records[0].get("c"),
                    serverInfo: responses[2],
                });
            })
            .catch(error => {
                console.error(error);
            });
    };

    render() {
        if (!this.props.active) return;
        document.title = "Start (db: " + db.getActiveDb() + ")";

        return (
            <>
                <div className="subtitle mb-2">Server</div>
                {Object.keys(this.state.serverInfo).length ? (
                    <div>
                        Connected to <b>{this.state.serverInfo["address"] || ""}</b> with protocol version <b>{this.state.serverInfo["protocolVersion"] || ""}</b>.
                    </div>
                ) : (
                    <div>Loading ...</div>
                )}
                <br />
                <div className="subtitle mb-2">Node labels</div>
                <div className="buttons">
                    {this.state.labels.length > 0 ? (
                        this.state.labels.map(label => <LabelButton key={label} label={label} database={db.getActiveDb()} tabManager={this.props.tabManager} size="is-medium" />)
                    ) : (
                        <span className="has-text-grey-light">none</span>
                    )}
                </div>
                <div className="buttons">
                    <Button
                        icon="fa-solid fa-plus"
                        text="Create node"
                        color=""
                        onClick={() =>
                            this.props.tabManager.add({ prefix: "New node" }, "fa-regular fa-square-plus", EPage.Node, { id: null, database: db.getActiveDb() }, new Date().getTime().toString())
                        }
                    />
                </div>
                <br />
                <div className="subtitle mb-2">Relationship types</div>
                <div className="buttons">
                    {this.state.types.length > 0 ? (
                        this.state.types.map(type => <TypeButton key={type} type={type} database={db.getActiveDb()} tabManager={this.props.tabManager} size="is-medium" />)
                    ) : (
                        <span className="has-text-grey-light">none</span>
                    )}
                </div>
                <br />
            </>
        );
    }
}

export default Start;